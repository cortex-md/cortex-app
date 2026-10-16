import type {
	AlertDialogOptions,
	AppUpdateInstallEvent,
	Collab,
	CollabChannelEvent,
	ConfirmDialogOptions,
	EffectiveAccess,
	FolderDialogOptions,
	InitialSyncProgressEvent,
	KeyTrustIssue,
	NativeAppearanceSnapshot,
	NativePlatform,
	NotificationActivation,
	Platform,
	SyncAccessDeniedEvent,
	SyncConflictEvent,
	SyncFileEvent,
	SyncStateEvent,
	WatchEvent,
	WatchOptions,
} from "@cortex/platform"
import { toMessageOptions } from "@cortex/platform/utils"
import type { MainApi, MainDomain, MainEventName, MainEvents } from "../../electron/contract"

interface CortexBridge {
	invoke(domain: string, method: string, args: unknown[]): Promise<unknown>
	on(event: string, listener: (payload: unknown) => void): () => void
}

declare global {
	interface Window {
		cortex?: CortexBridge
	}
}

function getCortexBridge(): CortexBridge {
	if (typeof window === "undefined" || !window.cortex) {
		throw new Error("Cortex Electron bridge is not available")
	}
	return window.cortex
}

function createDomainClient<D extends MainDomain>(domain: D): MainApi[D] {
	return new Proxy({} as MainApi[D], {
		get: (_target, method) => {
			if (typeof method !== "string" || method === "then") return undefined
			return (...args: unknown[]) => getCortexBridge().invoke(domain, method, args)
		},
	})
}

const domainClients = new Map<MainDomain, unknown>()

const main = new Proxy({} as MainApi, {
	get: (_target, domain) => {
		if (typeof domain !== "string" || domain === "then") return undefined
		const key = domain as MainDomain
		if (!domainClients.has(key)) domainClients.set(key, createDomainClient(key))
		return domainClients.get(key)
	},
})

function listen<E extends MainEventName>(
	event: E,
	listener: (payload: MainEvents[E]) => void,
): () => void {
	return getCortexBridge().on(event, listener as (payload: unknown) => void)
}

const collabListeners = new Map<string, (event: CollabChannelEvent) => void>()
let stopCollabEvents: (() => void) | null = null

function routeCollabEvents(
	channelId: string,
	listener: (event: CollabChannelEvent) => void,
): () => void {
	collabListeners.set(channelId, listener)
	stopCollabEvents ??= listen("collab-event", ({ channelId: target, event }) =>
		collabListeners.get(target)?.(event),
	)
	return () => {
		collabListeners.delete(channelId)
		if (collabListeners.size > 0) return
		stopCollabEvents?.()
		stopCollabEvents = null
	}
}

function reportCollabFailure(error: unknown): void {
	console.warn("[collab] channel request failed:", error)
}

const collab: Collab = {
	availability: (vaultId) => main.collab.availability(vaultId),
	open: async (vaultId, roomPath, onEvent) => {
		const channelId = crypto.randomUUID()
		let active = true
		const release = () => {
			if (!active) return false
			active = false
			stopRouting()
			return true
		}
		const stopRouting = routeCollabEvents(channelId, (event) => {
			if (!active) return
			if (event.type === "closed") release()
			onEvent(event)
		})
		try {
			await main.collab.open(channelId, vaultId, roomPath)
		} catch (error) {
			release()
			throw error
		}
		return {
			send: (op, payload) => {
				if (active) main.collab.send(channelId, op, payload).catch(reportCollabFailure)
			},
			compact: (state, upTo) => {
				if (active) main.collab.compact(channelId, state, upTo).catch(reportCollabFailure)
			},
			close: () => {
				if (release()) main.collab.close(channelId).catch(reportCollabFailure)
			},
		}
	},
	setFileSyncRole: (vaultId, roomPath, role) =>
		main.collab.setFileSyncRole(vaultId, roomPath, role),
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"
const HIGH_CONTRAST_QUERY = "(forced-colors: active)"

function detectPlatform(): NativePlatform {
	const userAgent = navigator.userAgent.toLowerCase()
	if (userAgent.includes("macintosh")) return "macos"
	if (userAgent.includes("windows")) return "windows"
	return "linux"
}

function readLocalAppearance(): NativeAppearanceSnapshot {
	const platform = detectPlatform()
	return {
		platform,
		colorScheme: window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light",
		reducedMotion: window.matchMedia(REDUCED_MOTION_QUERY).matches,
		highContrast: window.matchMedia(HIGH_CONTRAST_QUERY).matches,
		accentColor: null,
		scrollbarStyle: platform === "macos" ? "overlay" : platform === "windows" ? "thin" : "classic",
	}
}

async function getAppearanceSnapshot(): Promise<NativeAppearanceSnapshot> {
	const native = await main.app.getAppearanceSnapshot().catch(() => ({}))
	return { ...readLocalAppearance(), ...native }
}

function extend<T extends object, O extends object>(base: T, overrides: O): Omit<T, keyof O> & O {
	return Object.assign(Object.create(base) as T, overrides)
}

export const electronPlatform: Platform = {
	appearance: {
		getSnapshot: getAppearanceSnapshot,
		subscribe: (listener) => {
			const queries = [COLOR_SCHEME_QUERY, REDUCED_MOTION_QUERY, HIGH_CONTRAST_QUERY].map((query) =>
				window.matchMedia(query),
			)
			const notify = () => void getAppearanceSnapshot().then(listener)
			for (const query of queries) query.addEventListener("change", notify)
			return () => {
				for (const query of queries) query.removeEventListener("change", notify)
			}
		},
	},
	menu: main.menu,
	window: main.window,
	fs: extend(main.fs, {
		startWatching: async (
			path: string,
			callback: (event: WatchEvent) => void,
			options: WatchOptions = {},
		) => {
			const watcherId = await main.fs.startWatching(path, options)
			const unlisten = listen("vault-file-changed", (event) => {
				if (event.watcherId === watcherId) callback(event)
			})
			return () => {
				unlisten()
				void main.fs.stopWatching(watcherId)
			}
		},
	}),
	dialog: extend(main.dialog, {
		pickFolder: (options?: string | FolderDialogOptions) =>
			main.dialog.pickFolder(typeof options === "string" ? { title: options } : (options ?? {})),
		showConfirm: (titleOrOptions: string | ConfirmDialogOptions, message?: string) =>
			main.dialog.showConfirm(toMessageOptions(titleOrOptions, message)),
		showAlert: (titleOrOptions: string | AlertDialogOptions, message?: string) =>
			main.dialog.showAlert(toMessageOptions(titleOrOptions, message)),
	}),
	clipboard: {
		writeText: (text) => navigator.clipboard.writeText(text),
		readText: () => navigator.clipboard.readText(),
	},
	documentExport: { exportHtmlToPdf: (options) => main.documents.exportHtmlToPdf(options) },
	vault: main.vault,
	storage: {
		getAppDataDir: () => main.app.getDataDir(),
	},
	app: {
		getCurrentAppVersion: () => main.app.getVersion(),
		openExternalUrl: (url) => main.app.openExternalUrl(url),
		resolveFileAssetUrl: (path) => {
			const normalized = path.replaceAll("\\", "/")
			return `cortex-file://local${normalized.startsWith("/") ? "" : "/"}${encodeURI(normalized)}`
		},
		onDeepLinkOpen: (listener) => listen("deep-link-open", listener),
		onNativeEvent: (name, listener) =>
			listen(name as MainEventName, listener as (payload: unknown) => void),
	},
	appUpdates: extend(main.appUpdates, {
		installUpdate: async (onEvent?: (event: AppUpdateInstallEvent) => void) => {
			const unlisten = listen("app-update-install", (event) => onEvent?.(event))
			try {
				return await main.appUpdates.installUpdate()
			} finally {
				unlisten()
			}
		},
	}),
	font: main.font,
	http: {
		fetch: (url, options) => window.fetch(url, options),
		download: (url) => main.fs.downloadText(url),
	},
	keychain: main.keychain,
	device: main.device,
	auth: main.auth,
	account: main.account,
	subscription: main.subscription,
	remoteVault: main.remoteVault,
	members: main.members,
	shares: main.shares,
	templateShares: main.templateShares,
	devices: main.devices,
	sync: extend(main.sync, {
		onStateChanged: (callback: (event: SyncStateEvent) => void) =>
			listen("sync-state-changed", callback),
		onFileEvent: (callback: (event: SyncFileEvent) => void) => listen("sync-file-event", callback),
		onInitialSyncProgress: (callback: (event: InitialSyncProgressEvent) => void) =>
			listen("sync-initial-progress", callback),
		onConflict: (callback: (event: SyncConflictEvent) => void) => listen("sync-conflict", callback),
		onInitialSyncComplete: (callback: () => void) => listen("sync-initial-complete", callback),
		onVekRequired: (callback: () => void) => listen("sync-vek-required", callback),
		onAccessChanged: (callback: (access: EffectiveAccess | null) => void) =>
			listen("sync-access-changed", callback),
		onKeyTrustIssue: (callback: (issue: KeyTrustIssue) => void) =>
			listen("sync-key-trust-issue", callback),
		onVaultAccessDenied: (callback: (event: SyncAccessDeniedEvent) => void) =>
			listen("sync-vault-access-denied", callback),
		onSyncLog: (callback: (event: { level: string; message: string }) => void) =>
			listen("sync-log", callback),
	}),
	collab,
	notifications: extend(main.notifications, {
		getCapabilities: () => ({
			supported: true,
			icons: false,
			sounds: true,
			actions: true,
			schedule: true,
			reply: detectPlatform() === "macos",
		}),
		onActivation: (listener: (activation: NotificationActivation) => void) =>
			listen("notification-activation", listener),
	}),
	capabilities: [
		"menu",
		"hotkeys",
		"notifications",
		"notifications:sounds",
		"notifications:actions",
		"notifications:schedule",
	],
}
