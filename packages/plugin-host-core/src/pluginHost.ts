import { type FileEntry, getPlatform, type WatchEvent } from "@cortex/platform"
import { registerPropertyType } from "@cortex/properties"
import { registerMarkdownPreprocessor, registerMarkdownProcessor } from "@cortex/renderer"
import type {
	Disposable,
	PluginActivationResult,
	PluginContext,
	PluginDefinition,
	PluginImplementation,
	VaultFileEvent,
} from "@cortex.md/api"
import {
	assertCommunityStyles,
	type CommunityPluginDiscovery,
	evaluateCommunityPlugin,
	getCommunityPluginsDir,
	getErrorMessage,
	isPluginDirInside,
	readCommunityPluginFiles,
	reportPluginOperationError,
	validatePluginDefinition,
} from "./communityPlugins"
import { createEditorContributions, registerMarkdownContributions } from "./editorSurface"
import {
	createPluginContext,
	type PluginContextHost,
	type PluginHostServices,
} from "./pluginContext"
import {
	executePluginCommand,
	type PluginCommand,
	type PluginView,
	registerPluginContributions,
} from "./pluginContributions"
import { activatePluginDefinition, bindPluginView, getCommandHandler } from "./pluginRuntime"
import {
	clearOwnerContributions,
	closeModal,
	getContributionKey,
	openModal,
	setOwnerSettingsValues,
	setPluginLoadError,
	setPluginRecord,
	setPluginStatus,
	updateView,
	usePluginStore,
} from "./pluginStore"

type PluginContextValue = PluginContext
type SettingListener = (value: unknown, oldValue: unknown) => void

interface PluginEntry {
	definition: PluginDefinition
	community: { dirPath: string; styles: string | null } | null
}

interface ActivePlugin {
	id: string
	entry: PluginEntry
	context: PluginContextValue
	disposables: Disposable[]
	storedSettings: Record<string, unknown> | null
	settingListeners: Map<string, Set<SettingListener>>
	activation: Promise<void> | null
	implementation: PluginImplementation | null
}

export interface PluginHost {
	registerBundledPlugins(definitions: readonly PluginDefinition[]): void
	enablePlugin(pluginId: string): Promise<void>
	disablePlugin(pluginId: string): Promise<void>
	disableAllPlugins(): Promise<void>
	loadEnabledPlugins(): Promise<void>
	saveEnabledPlugins(): Promise<void>
	setPluginSetting(pluginId: string, key: string, value: unknown): Promise<void>
	isPluginInstalled(pluginId: string): boolean
	getCommunityPluginsDir(): string | null
	getCommunityPluginLoadError(pluginId: string): string | null
	discoverCommunityPlugins(pluginsDir: string): Promise<void>
	reloadCommunityPlugins(pluginsDir: string): Promise<void>
	syncCommunityAccess(): Promise<void>
	unregisterCommunityPlugin(pluginId: string): void
	getPluginContext(pluginId: string): PluginContext | null
	getPluginDefinition(pluginId: string): PluginDefinition | null
}

function runInOrder(ids: string[], operation: (id: string) => Promise<void>): Promise<void> {
	return ids.reduce((pending, id) => pending.then(() => operation(id)), Promise.resolve())
}

function toDisposable(dispose: () => void): Disposable {
	return { dispose }
}

function getSettingDefaults(definition: PluginDefinition): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(definition.settings ?? {}).map(([key, setting]) => [key, setting.default]),
	)
}

const VAULT_EVENT_TYPES: Record<WatchEvent["kind"], VaultFileEvent["type"]> = {
	created: "create",
	modified: "modify",
	deleted: "delete",
	renamed: "rename",
}

export function createPluginHost(services: PluginHostServices): PluginHost {
	const entries = new Map<string, PluginEntry>()
	const active = new Map<string, ActivePlugin>()
	const editorContributions = services.editorRuntime
		? createEditorContributions(services.editorRuntime)
		: null
	const vaultListeners = new Set<(event: VaultFileEvent) => void>()
	let stopVaultWatcher: (() => void) | null = null
	let vaultWatcherToken = 0
	let editorExternals: Promise<Record<string, unknown>> | null = null
	const isCommunityAllowed = () => services.community?.isAllowed() === true

	function subscribeVaultFiles(callback: (event: VaultFileEvent) => void): () => void {
		vaultListeners.add(callback)
		if (vaultListeners.size === 1) startVaultWatcher()
		return () => {
			vaultListeners.delete(callback)
			if (vaultListeners.size > 0) return
			vaultWatcherToken++
			stopVaultWatcher?.()
			stopVaultWatcher = null
		}
	}

	function startVaultWatcher(): void {
		const vaultPath = services.getVaultPath()
		if (!vaultPath) return
		const token = ++vaultWatcherToken
		const prefix = `${vaultPath.replaceAll("\\", "/")}/`
		void getPlatform()
			.fs.startWatching(vaultPath, (event) => {
				const path = event.path.replaceAll("\\", "/")
				const vaultEvent: VaultFileEvent = {
					type: VAULT_EVENT_TYPES[event.kind],
					path: path.startsWith(prefix) ? path.slice(prefix.length) : path,
				}
				for (const listener of vaultListeners) listener(vaultEvent)
			})
			.then((stop) => {
				if (token === vaultWatcherToken) stopVaultWatcher = stop
				else stop()
			})
			.catch((error) => reportPluginOperationError("watch-vault", "vault", error))
	}

	function getSettingsFilePath(pluginId: string): string | null {
		const vaultPath = services.getVaultPath()
		return vaultPath ? `${vaultPath}/.cortex/plugins/${pluginId}/settings.json` : null
	}

	async function loadStoredSettings(plugin: ActivePlugin): Promise<Record<string, unknown>> {
		if (plugin.storedSettings) return plugin.storedSettings
		const filePath = getSettingsFilePath(plugin.id)
		let stored: Record<string, unknown> = {}
		if (filePath) {
			try {
				stored = JSON.parse(await getPlatform().fs.readFile(filePath)) as Record<string, unknown>
			} catch {}
		}
		plugin.storedSettings = stored
		setOwnerSettingsValues(plugin.id, { ...getSettingDefaults(plugin.entry.definition), ...stored })
		return stored
	}

	function getSettings(plugin: ActivePlugin): Record<string, unknown> {
		return (
			usePluginStore.getState().settingsValues[plugin.id] ??
			getSettingDefaults(plugin.entry.definition)
		)
	}

	async function setSetting(plugin: ActivePlugin, key: string, value: unknown): Promise<void> {
		const stored = plugin.storedSettings ?? (await loadStoredSettings(plugin))
		const values = getSettings(plugin)
		const oldValue = values[key]
		if (Object.is(oldValue, value)) return
		stored[key] = value
		setOwnerSettingsValues(plugin.id, { ...values, [key]: value })
		const filePath = getSettingsFilePath(plugin.id)
		if (filePath) {
			const platform = getPlatform()
			await platform.fs.createDir(filePath.replace(/\/[^/]+$/, ""))
			await platform.fs.writeFile(filePath, JSON.stringify(stored, null, "\t"))
		}
		for (const listener of plugin.settingListeners.get(key) ?? []) listener(value, oldValue)
	}

	function onSettingChange(plugin: ActivePlugin, key: string, listener: SettingListener) {
		let listeners = plugin.settingListeners.get(key)
		if (!listeners) {
			listeners = new Set()
			plugin.settingListeners.set(key, listeners)
		}
		listeners.add(listener)
		return toDisposable(() => listeners.delete(listener))
	}

	function trackActivationResult(plugin: ActivePlugin, result: PluginActivationResult): void {
		if (!result) return
		const disposable = typeof result === "function" ? toDisposable(result) : result
		if (active.get(plugin.id) === plugin) plugin.disposables.push(disposable)
		else disposable.dispose()
	}

	function activatePlugin(plugin: ActivePlugin): Promise<void> {
		plugin.activation ??= activatePluginDefinition(plugin.entry.definition, plugin.context, {
			onLoad(implementation) {
				plugin.implementation = implementation
				resolveLazyViews(plugin)
			},
			track: (result) => trackActivationResult(plugin, result),
		}).catch((error: unknown) => {
			if (active.get(plugin.id) === plugin) setPluginStatus(plugin.id, "error", String(error))
			throw error
		})
		return plugin.activation
	}

	function resolveLazyViews(plugin: ActivePlugin): void {
		for (const view of plugin.entry.definition.contributes?.views ?? []) {
			if (view.render) continue
			const handlers = plugin.implementation?.views?.[view.id]
			if (handlers) {
				updateView(
					getContributionKey(plugin.id, view.id),
					bindPluginView(plugin.id, handlers, plugin.context),
				)
			}
		}
	}

	async function runCommand(
		plugin: ActivePlugin,
		command: PluginCommand,
		payload: unknown,
	): Promise<void> {
		await activatePlugin(plugin)
		if (active.get(plugin.id) !== plugin) return
		await getCommandHandler(plugin.id, command, plugin.implementation)(plugin.context, payload)
	}

	function bindView(plugin: ActivePlugin, view: PluginView) {
		const { definition } = plugin.entry
		const needsActivation = Boolean(definition.load || definition.activate)
		return {
			...(view.render ? bindPluginView(plugin.id, view, plugin.context) : {}),
			activate: needsActivation || !view.render ? () => activatePlugin(plugin) : undefined,
		}
	}

	function registerStaticContributions(plugin: ActivePlugin): void {
		const { id: pluginId, entry, disposables } = plugin
		const { definition } = entry
		disposables.push(
			toDisposable(
				registerPluginContributions(definition, {
					runCommand: (command, payload) => runCommand(plugin, command, payload),
					bindView: (view) => bindView(plugin, view),
				}),
			),
		)

		const contributes = definition.contributes ?? {}
		const markdown = contributes.markdown ?? {}
		disposables.push(
			...registerMarkdownContributions(pluginId, markdown, {
				get: (key) => getSettings(plugin)[key],
				onChange: (key, listener) => onSettingChange(plugin, key, listener),
			}),
		)
		for (const preprocessor of markdown.preprocessors ?? []) {
			disposables.push(toDisposable(registerMarkdownPreprocessor(preprocessor, pluginId)))
		}
		for (const processor of markdown.processors ?? []) {
			disposables.push(toDisposable(registerMarkdownProcessor(processor, pluginId)))
		}
		for (const propertyType of contributes.propertyTypes ?? []) {
			disposables.push(
				toDisposable(
					registerPropertyType({
						...propertyType,
						type: `${pluginId}:${propertyType.type.trim()}`,
					}),
				),
			)
		}
	}

	async function registerEditorContributions(plugin: ActivePlugin): Promise<void> {
		if (!editorContributions) return
		const { editorExtensions, foldProviders = [] } = plugin.entry.definition.contributes ?? {}
		plugin.disposables.push(...editorContributions.addFoldProviders(plugin.id, foldProviders))
		if (editorExtensions) {
			editorContributions.setExtensions(plugin.id, await editorExtensions(plugin.context))
		}
		if (editorExtensions || foldProviders.length > 0) editorContributions.apply()
	}

	function createContextHost(plugin: ActivePlugin): PluginContextHost {
		return {
			services,
			track(disposable) {
				plugin.disposables.push(disposable)
				return disposable
			},
			getSetting: (key) => getSettings(plugin)[key],
			getSettings: () => getSettings(plugin),
			setSetting: (key, value) => setSetting(plugin, key, value),
			onSettingChange: (key, callback) => {
				const disposable = onSettingChange(plugin, key, callback)
				plugin.disposables.push(disposable)
				return disposable
			},
			executeCommand: (commandId, payload) => executePluginCommand(plugin.id, commandId, payload),
			openModal: (viewId, options) =>
				openModal(plugin.id, getContributionKey(plugin.id, viewId), options),
			closeModal: (instanceId) => closeModal(instanceId, plugin.id),
			openView(viewId, options) {
				const key = getContributionKey(plugin.id, viewId)
				const view = usePluginStore.getState().views.find((candidate) => candidate.key === key)
				if (view) services.workspace.openView(key, view.label, options)
			},
			subscribeVaultFiles,
		}
	}

	function disposePlugin(plugin: ActivePlugin): void {
		const hadEditorContributions = editorContributions?.removePlugin(plugin.id) ?? false
		for (const disposable of plugin.disposables.reverse()) {
			try {
				disposable.dispose()
			} catch (error) {
				reportPluginOperationError("dispose", plugin.id, error)
			}
		}
		plugin.disposables = []
		plugin.settingListeners.clear()
		services.community?.styles.remove(plugin.id)
		clearOwnerContributions(plugin.id)
		if (hadEditorContributions) editorContributions?.apply()
	}

	async function enablePlugin(pluginId: string): Promise<void> {
		if (active.has(pluginId)) return
		const entry = entries.get(pluginId)
		if (!entry) throw new Error(`Plugin not found: ${pluginId}`)
		if (entry.community && !isCommunityAllowed())
			throw new Error("Community plugins are turned off")
		const plugin: ActivePlugin = {
			id: pluginId,
			entry,
			context: null as unknown as PluginContextValue,
			disposables: [],
			storedSettings: null,
			settingListeners: new Map(),
			activation: null,
			implementation: null,
		}
		plugin.context = createPluginContext(entry.definition.manifest, createContextHost(plugin))
		active.set(pluginId, plugin)
		try {
			if (entry.definition.settings) await loadStoredSettings(plugin)
			registerStaticContributions(plugin)
			await registerEditorContributions(plugin)
			if (entry.community?.styles)
				services.community?.styles.install(pluginId, entry.community.styles)
			if (entry.definition.activation === "startup") await activatePlugin(plugin)
			setPluginStatus(pluginId, "enabled")
		} catch (error) {
			active.delete(pluginId)
			disposePlugin(plugin)
			setPluginStatus(pluginId, "error", String(error))
			throw error
		}
	}

	async function disablePlugin(pluginId: string): Promise<void> {
		const plugin = active.get(pluginId)
		if (!plugin) return
		active.delete(pluginId)
		disposePlugin(plugin)
		setPluginStatus(pluginId, "disabled")
	}

	function registerPlugin(definition: PluginDefinition, community: PluginEntry["community"]) {
		validatePluginDefinition(definition)
		const pluginId = definition.manifest.id
		entries.set(pluginId, { definition, community })
		setPluginLoadError(pluginId, null)
		setPluginRecord(pluginId, {
			manifest: definition.manifest,
			status: active.has(pluginId) ? "enabled" : "loaded",
			community: community !== null,
		})
	}

	function unregisterCommunityPlugin(pluginId: string): void {
		entries.delete(pluginId)
		setPluginLoadError(pluginId, null)
		setPluginRecord(pluginId, null)
	}

	function getCommunityEntryIds(predicate: (id: string, dirPath: string) => boolean): string[] {
		return Array.from(entries, ([id, entry]) =>
			entry.community && predicate(id, entry.community.dirPath) ? [id] : [],
		).flat()
	}

	function loadCommunityExternals(needsEditorExternals: boolean) {
		const community = services.community
		if (!needsEditorExternals || !community) return Promise.resolve({})
		editorExternals ??= community.loadEditorExternals().catch((error: unknown) => {
			editorExternals = null
			throw error
		})
		return editorExternals
	}

	async function discoverCommunityPlugin(directory: FileEntry): Promise<CommunityPluginDiscovery> {
		const read = await readCommunityPluginFiles(directory, getPlatform().fs)
		if ("error" in read) return read
		const { pluginId, dirPath, files } = read
		try {
			const definition = await evaluateCommunityPlugin(files.code, {
				manifestId: files.manifest.id,
				loadExternals: loadCommunityExternals,
			})
			assertCommunityStyles(files.styles, Boolean(definition.contributes?.markdown))
			return {
				pluginId,
				dirPath,
				definition: {
					...definition,
					manifest: { ...definition.manifest, main: files.manifest.main },
				},
				styles: files.styles,
			}
		} catch (error) {
			return { pluginId, dirPath, error: getErrorMessage(error) }
		}
	}

	async function discoverCommunityPlugins(pluginsDir: string): Promise<void> {
		if (!services.community) throw new Error("Community plugins are not supported by this host")
		if (!isCommunityAllowed()) return
		let directories: FileEntry[]
		try {
			directories = (await getPlatform().fs.listDir(pluginsDir)).filter((entry) => entry.isDir)
		} catch {
			return
		}
		const discoveries = await Promise.all(directories.map(discoverCommunityPlugin))
		const discoveredIds = new Set(discoveries.map((discovery) => discovery.pluginId))
		for (const discovery of discoveries) {
			if ("error" in discovery) {
				unregisterCommunityPlugin(discovery.pluginId)
				setPluginLoadError(discovery.pluginId, discovery.error)
				continue
			}
			registerPlugin(discovery.definition, {
				dirPath: discovery.dirPath,
				styles: discovery.styles,
			})
		}
		const removedIds = getCommunityEntryIds(
			(id, dirPath) => isPluginDirInside(dirPath, pluginsDir) && !discoveredIds.has(id),
		)
		await runInOrder(removedIds, async (pluginId) => {
			await disablePlugin(pluginId)
			unregisterCommunityPlugin(pluginId)
		})
	}

	async function reloadCommunityPlugins(pluginsDir: string): Promise<void> {
		const enabledIds = getCommunityEntryIds(
			(id, dirPath) => active.has(id) && isPluginDirInside(dirPath, pluginsDir),
		)
		await runInOrder(enabledIds, disablePlugin)
		await discoverCommunityPlugins(pluginsDir)
		await runInOrder(enabledIds, async (pluginId) => {
			if (!entries.has(pluginId)) return
			try {
				await enablePlugin(pluginId)
			} catch (error) {
				reportPluginOperationError("reload", pluginId, error)
			}
		})
	}

	async function syncCommunityAccess(): Promise<void> {
		if (!isCommunityAllowed()) {
			await runInOrder(
				getCommunityEntryIds(() => true),
				async (pluginId) => {
					await disablePlugin(pluginId)
					unregisterCommunityPlugin(pluginId)
				},
			)
			for (const pluginId of Object.keys(usePluginStore.getState().loadErrors)) {
				if (!entries.has(pluginId)) setPluginLoadError(pluginId, null)
			}
			return
		}
		const pluginsDir = getCommunityPluginsDir(services.getVaultPath())
		if (!pluginsDir) return
		await discoverCommunityPlugins(pluginsDir)
		await loadEnabledPlugins()
	}

	async function loadEnabledPlugins(): Promise<void> {
		const vaultPath = services.getVaultPath()
		const storedIds = vaultPath ? await readEnabledPluginIds(vaultPath) : null
		const ids =
			storedIds ?? Array.from(entries, ([id, entry]) => (entry.community ? [] : [id])).flat()
		await runInOrder(ids, async (pluginId) => {
			if (!entries.has(pluginId)) return
			try {
				await enablePlugin(pluginId)
			} catch (error) {
				reportPluginOperationError("load-enabled", pluginId, error)
			}
		})
		if (vaultPath && !storedIds) await saveEnabledPlugins()
	}

	async function readEnabledPluginIds(vaultPath: string): Promise<string[] | null> {
		let content: string
		try {
			content = await getPlatform().fs.readFile(`${vaultPath}/.cortex/plugins.json`)
		} catch {
			return null
		}
		try {
			const data = JSON.parse(content) as { enabled?: unknown }
			return Array.isArray(data.enabled)
				? data.enabled.filter((id): id is string => typeof id === "string")
				: []
		} catch (error) {
			reportPluginOperationError("read-enabled", "registry", error)
			return []
		}
	}

	async function saveEnabledPlugins(): Promise<void> {
		const vaultPath = services.getVaultPath()
		if (!vaultPath) return
		const enabled = Array.from(active.keys())
		if (!isCommunityAllowed()) {
			const stored = (await readEnabledPluginIds(vaultPath)) ?? []
			enabled.push(...stored.filter((pluginId) => !entries.has(pluginId)))
		}
		const content = JSON.stringify({ enabled }, null, "\t")
		try {
			await getPlatform().fs.writeFile(`${vaultPath}/.cortex/plugins.json`, content)
		} catch (error) {
			reportPluginOperationError("save-enabled", "registry", error)
		}
	}

	return {
		registerBundledPlugins(definitions) {
			for (const definition of definitions) registerPlugin(definition, null)
		},
		enablePlugin,
		disablePlugin,
		disableAllPlugins: () => runInOrder(Array.from(active.keys()), disablePlugin),
		loadEnabledPlugins,
		saveEnabledPlugins,
		async setPluginSetting(pluginId, key, value) {
			const plugin = active.get(pluginId)
			if (!plugin) throw new Error(`Plugin is not enabled: ${pluginId}`)
			await setSetting(plugin, key, value)
		},
		isPluginInstalled: (pluginId) => entries.has(pluginId),
		getCommunityPluginsDir: () => getCommunityPluginsDir(services.getVaultPath()),
		getCommunityPluginLoadError: (pluginId) =>
			usePluginStore.getState().loadErrors[pluginId] ?? null,
		discoverCommunityPlugins,
		reloadCommunityPlugins,
		syncCommunityAccess,
		unregisterCommunityPlugin,
		getPluginContext: (pluginId) => active.get(pluginId)?.context ?? null,
		getPluginDefinition: (pluginId) => entries.get(pluginId)?.definition ?? null,
	}
}
