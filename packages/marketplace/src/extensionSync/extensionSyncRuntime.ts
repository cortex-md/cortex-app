import { getPlatform } from "@cortex/platform"
import { getStateFile, type StateFile } from "@cortex/platform/state-file"
import { getVaultFilePath, VAULT_FILES } from "@cortex/platform/utils"
import { type ExtensionSyncMemory, getLocalVaultState } from "@cortex/platform/vault-state"
import { parseCommunityThemeManifest } from "@cortex/theme"
import {
	getMarketplaceCallbacks,
	subscribeInstalledExtensions,
	useMarketplaceStore,
} from "../marketplaceStore"
import { fetchPluginRegistry, fetchThemeRegistry } from "../registryService"
import type { RegistryEntry } from "../types"
import { resetExtensionSyncStatus, setExtensionSyncStatus } from "./extensionSyncStore"
import {
	deriveManifest,
	EXTENSION_MANIFEST_VERSION,
	type ExtensionSyncKind,
	type LocalExtension,
	type LocalExtensionView,
	parseManifestItems,
	planReconcile,
	type SyncedExtension,
	serializeManifest,
	summarizeSync,
} from "./plan"

export interface ExtensionSyncPluginSnapshot {
	vaultPath: string | null
	plugins: ReadonlyArray<{
		id: string
		version: string | null
		enabled: boolean
		community: boolean
	}>
}

export interface ExtensionSyncServices {
	getVaultPath(): string | null
	subscribeVault(listener: () => void): () => void
	isSyncEnabled(kind: ExtensionSyncKind): boolean
	isCommunityAllowed(): boolean
	subscribeSettings(listener: () => void): () => void
	getPlugins(): ExtensionSyncPluginSnapshot
	subscribePlugins(listener: () => void): () => void
	enablePlugin(pluginId: string): Promise<void>
	disablePlugin(pluginId: string): Promise<void>
	saveEnabledPlugins(): Promise<void>
	scheduleIdle?(task: () => void): () => void
}

const KINDS: readonly ExtensionSyncKind[] = ["plugins", "themes"]
const LOCAL_CHANGE_DELAY_MS = 500
const MANIFEST_CHANGE_DELAY_MS = 300
const IDLE_FALLBACK_MS = 1500

type ManifestFile = { version: number } & Partial<Record<ExtensionSyncKind, SyncedExtension[]>>

interface Session {
	vaultPath: string
	active: boolean
	queue: Promise<void>
	lastCanonical: Record<ExtensionSyncKind, string | null>
	manifest: Record<ExtensionSyncKind, SyncedExtension[] | null>
	unavailable: Record<ExtensionSyncKind, Set<string>>
	failed: Record<ExtensionSyncKind, Set<string>>
	themes: LocalExtension[] | null
	started: boolean
	idleDone: boolean
	timers: Map<string, ReturnType<typeof setTimeout>>
	stopWatcher: (() => void) | null
	cancelIdle: (() => void) | null
}

const MANIFEST_PATHS: Record<ExtensionSyncKind, string> = {
	plugins: VAULT_FILES.pluginsSyncManifest,
	themes: VAULT_FILES.themesSyncManifest,
}

function manifestPath(vaultPath: string, kind: ExtensionSyncKind): string {
	return getVaultFilePath(vaultPath, MANIFEST_PATHS[kind])
}

function manifestFile(vaultPath: string, kind: ExtensionSyncKind): StateFile<ManifestFile> {
	return getStateFile<ManifestFile>({
		path: manifestPath(vaultPath, kind),
		parse: (raw) => ({
			version: EXTENSION_MANIFEST_VERSION,
			[kind]: parseManifestItems(kind, raw),
		}),
		empty: () => ({ version: EXTENSION_MANIFEST_VERSION, [kind]: [] }),
		io: () => getPlatform().fs,
	})
}

async function readManifest(
	vaultPath: string,
	kind: ExtensionSyncKind,
): Promise<SyncedExtension[] | null> {
	try {
		const text = await getPlatform().fs.readFile(manifestPath(vaultPath, kind))
		const parsed = JSON.parse(text) as unknown
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
		return parseManifestItems(kind, parsed as Record<string, unknown>)
	} catch {
		return null
	}
}

async function readInstalledThemes(themesDir: string): Promise<LocalExtension[]> {
	const platform = getPlatform()
	const entries = await platform.fs.listDir(themesDir).catch(() => [])
	const themes = await Promise.all(
		entries
			.filter((entry) => entry.isDir && !entry.name.startsWith("."))
			.map(async (entry) => {
				try {
					const manifest = parseCommunityThemeManifest(
						await platform.fs.readFile(`${themesDir}/${entry.name}/manifest.json`),
					)
					const theme: LocalExtension = {
						id: manifest.id,
						version: manifest.version,
						community: true,
					}
					return theme
				} catch {
					return null
				}
			}),
	)
	return themes.filter((theme): theme is LocalExtension => theme !== null)
}

async function runSequentially<T>(items: readonly T[], task: (item: T) => Promise<void>) {
	for (const item of items) await task(item)
}

export function startExtensionSync(services: ExtensionSyncServices): () => void {
	let session: Session | null = null

	const schedule = (current: Session, key: string, delay: number, task: () => void) => {
		const existing = current.timers.get(key)
		if (existing) clearTimeout(existing)
		current.timers.set(
			key,
			setTimeout(() => {
				current.timers.delete(key)
				if (current.active) task()
			}, delay),
		)
	}

	const enqueue = (current: Session, task: () => Promise<void>) => {
		current.queue = current.queue
			.then(() => (current.active ? task() : undefined))
			.catch((error: unknown) => console.warn("[extension-sync]", error))
		return current.queue
	}

	const localView = async (
		current: Session,
		kind: ExtensionSyncKind,
	): Promise<LocalExtensionView | null> => {
		if (kind === "plugins") {
			const snapshot = services.getPlugins()
			if (snapshot.vaultPath !== current.vaultPath) return null
			return { items: snapshot.plugins, communityVisible: services.isCommunityAllowed() }
		}
		if (!current.themes) {
			const themesDir = getMarketplaceCallbacks()?.getThemesDir()
			if (!themesDir) return null
			current.themes = await readInstalledThemes(themesDir)
		}
		return { items: current.themes, communityVisible: true }
	}

	const readMemory = async (current: Session): Promise<ExtensionSyncMemory> =>
		(await getLocalVaultState(current.vaultPath).read()).extensionSync

	const publishStatus = async (current: Session, kind: ExtensionSyncKind) => {
		const local = await localView(current, kind)
		const manifest = current.manifest[kind]
		if (!local || !manifest) return
		const memory = (await readMemory(current))[kind]
		setExtensionSyncStatus(kind, {
			state: "idle",
			...summarizeSync(kind, manifest, local, memory, {
				unavailable: current.unavailable[kind],
				failed: current.failed[kind],
			}),
		})
	}

	const write = async (current: Session, kind: ExtensionSyncKind) => {
		const local = await localView(current, kind)
		if (!local) return
		const state = await readMemory(current)
		const memory = state[kind]
		current.manifest[kind] ??= await readManifest(current.vaultPath, kind)
		const derived = deriveManifest(kind, current.manifest[kind], local, memory)
		const canonical = serializeManifest(kind, derived.items)
		if (canonical !== current.lastCanonical[kind]) {
			current.lastCanonical[kind] = canonical
			current.manifest[kind] = derived.items
			await manifestFile(current.vaultPath, kind).update(
				() => ({ version: EXTENSION_MANIFEST_VERSION, [kind]: derived.items }),
				{ immediate: true },
			)
		}
		const nextMemory =
			kind === "plugins"
				? { known: derived.known, approved: derived.approved }
				: { known: derived.known }
		if (JSON.stringify(nextMemory) !== JSON.stringify(memory)) {
			await getLocalVaultState(current.vaultPath).update((value) => ({
				...value,
				extensionSync: { ...value.extensionSync, [kind]: nextMemory },
			}))
		}
		await publishStatus(current, kind)
	}

	const reconcile = async (current: Session, kind: ExtensionSyncKind) => {
		if (!services.isSyncEnabled(kind)) return
		const remote = await readManifest(current.vaultPath, kind)
		if (!remote) return
		current.lastCanonical[kind] = serializeManifest(kind, remote)
		current.manifest[kind] = remote
		const local = await localView(current, kind)
		if (!local) return
		const memory = (await readMemory(current))[kind]
		const plan = planReconcile(kind, remote, local, memory)
		const downloads = [...plan.install, ...plan.update]
		const changes = downloads.length + plan.uninstall.length + plan.enable.length
		if (changes + plan.disable.length === 0) return
		setExtensionSyncStatus(kind, { state: "syncing" })
		const tab = kind
		const store = useMarketplaceStore.getState()
		let registry: Map<string, RegistryEntry> = new Map()
		if (downloads.length > 0) {
			try {
				const entries =
					kind === "plugins" ? await fetchPluginRegistry() : await fetchThemeRegistry()
				registry = new Map(entries.map((entry) => [entry.id, entry]))
			} catch {
				for (const item of downloads) current.failed[kind].add(item.id)
			}
		}
		const installed = new Set<string>()
		await runSequentially(downloads, async (item) => {
			if (!current.active) return
			const entry = registry.get(item.id)
			if (!entry) {
				if (registry.size > 0) current.unavailable[kind].add(item.id)
				return
			}
			const ok = await store.installEntry(entry, tab, { version: item.version, quiet: true })
			if (ok) {
				installed.add(item.id)
				current.failed[kind].delete(item.id)
				current.unavailable[kind].delete(item.id)
			} else {
				current.failed[kind].add(item.id)
			}
		})
		await runSequentially(plan.uninstall, async (id) => {
			if (!current.active) return
			await store.uninstallEntry({ id, name: id }, tab, { quiet: true })
		})
		if (kind === "plugins") {
			const pending = new Set(plan.install.map((item) => item.id))
			await runSequentially(plan.enable, async (id) => {
				if (!current.active || (pending.has(id) && !installed.has(id))) return
				await services.enablePlugin(id).catch(() => current.failed.plugins.add(id))
			})
			await runSequentially(plan.disable, async (id) => {
				if (current.active) await services.disablePlugin(id).catch(() => undefined)
			})
			if (plan.enable.length > 0 || plan.disable.length > 0) await services.saveEnabledPlugins()
		} else {
			current.themes = null
		}
	}

	const sync = (current: Session, kinds: readonly ExtensionSyncKind[]) =>
		enqueue(current, async () => {
			for (const kind of kinds) {
				await reconcile(current, kind)
				await write(current, kind)
			}
		})

	const scheduleWrite = (current: Session, kind: ExtensionSyncKind) => {
		if (!current.started) return
		schedule(current, `write:${kind}`, LOCAL_CHANGE_DELAY_MS, () => {
			if (kind === "themes") current.themes = null
			void enqueue(current, () => write(current, kind))
		})
	}

	const watchManifests = async (current: Session) => {
		const names = new Map(
			KINDS.map((kind) => [manifestPath(current.vaultPath, kind), kind] as const),
		)
		try {
			const stop = await getPlatform().fs.startWatching(
				getVaultFilePath(current.vaultPath, ".cortex"),
				(event) => {
					const kind = names.get(event.path.replaceAll("\\", "/"))
					if (!kind) return
					schedule(current, `remote:${kind}`, MANIFEST_CHANGE_DELAY_MS, () => {
						void enqueue(current, async () => {
							const remote = await readManifest(current.vaultPath, kind)
							if (!remote) return
							if (serializeManifest(kind, remote) === current.lastCanonical[kind]) return
							manifestFile(current.vaultPath, kind).forget()
							await reconcile(current, kind)
							await write(current, kind)
						})
					})
				},
				{ includeHidden: true },
			)
			if (current.active) current.stopWatcher = stop
			else stop()
		} catch (error) {
			console.warn("[extension-sync] failed to watch manifests:", error)
		}
	}

	const tryStart = (current: Session) => {
		if (current.started || !current.active) return
		if (services.getPlugins().vaultPath !== current.vaultPath) return
		current.started = true
		void watchManifests(current)
		void sync(current, KINDS)
	}

	const openSession = (vaultPath: string | null) => {
		if (session) {
			session.active = false
			for (const timer of session.timers.values()) clearTimeout(timer)
			session.stopWatcher?.()
			session.cancelIdle?.()
		}
		session = null
		resetExtensionSyncStatus()
		if (!vaultPath) return
		const current: Session = {
			vaultPath,
			active: true,
			queue: Promise.resolve(),
			lastCanonical: { plugins: null, themes: null },
			manifest: { plugins: null, themes: null },
			unavailable: { plugins: new Set(), themes: new Set() },
			failed: { plugins: new Set(), themes: new Set() },
			themes: null,
			started: false,
			idleDone: false,
			timers: new Map(),
			stopWatcher: null,
			cancelIdle: null,
		}
		session = current
		const idle =
			services.scheduleIdle ??
			((task: () => void) => {
				const timer = setTimeout(task, IDLE_FALLBACK_MS)
				return () => clearTimeout(timer)
			})
		current.cancelIdle = idle(() => {
			current.idleDone = true
			tryStart(current)
		})
	}

	let syncEnabled = Object.fromEntries(KINDS.map((kind) => [kind, services.isSyncEnabled(kind)]))
	let communityAllowed = services.isCommunityAllowed()

	openSession(services.getVaultPath())
	const unsubscribeVault = services.subscribeVault(() => {
		const vaultPath = services.getVaultPath()
		if (vaultPath !== (session?.vaultPath ?? null)) openSession(vaultPath)
	})
	const unsubscribePlugins = services.subscribePlugins(() => {
		const current = session
		if (!current) return
		if (!current.started) {
			if (current.idleDone) tryStart(current)
			return
		}
		scheduleWrite(current, "plugins")
	})
	const unsubscribeInstalled = subscribeInstalledExtensions((kind) => {
		if (session) scheduleWrite(session, kind)
	})
	const unsubscribeSettings = services.subscribeSettings(() => {
		const current = session
		const nextEnabled = Object.fromEntries(
			KINDS.map((kind) => [kind, services.isSyncEnabled(kind)]),
		)
		const nextCommunity = services.isCommunityAllowed()
		const turnedOn = KINDS.filter((kind) => nextEnabled[kind] && !syncEnabled[kind])
		const communityChanged = nextCommunity !== communityAllowed
		syncEnabled = nextEnabled
		communityAllowed = nextCommunity
		if (!current?.started) return
		const kinds = new Set<ExtensionSyncKind>(turnedOn)
		if (communityChanged) kinds.add("plugins")
		if (kinds.size > 0) void sync(current, [...kinds])
	})

	return () => {
		unsubscribeVault()
		unsubscribePlugins()
		unsubscribeInstalled()
		unsubscribeSettings()
		openSession(null)
	}
}
