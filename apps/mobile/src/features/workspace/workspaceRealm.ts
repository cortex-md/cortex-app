import { requireBookmarkPath } from "@cortex/core/bookmark-paths"
import { extractAllTags, parseFrontmatter } from "@cortex/core/frontmatter"
import { pluginEditorRuntime } from "@cortex/editor/extensions"
import { loadCodeMirrorCommunityPluginExternals } from "@cortex/editor/runtime"
import { initPlatform, type Platform, type WatchEvent } from "@cortex/platform"
import {
	createCodeMirrorActiveEditor,
	createPluginHost,
	createPluginHostMirror,
	type JsonValue,
	type PluginHostMirror,
	type PluginHostServices,
	type PluginMarkdownStyleHost,
	reportPluginOperationError,
	usePluginStore,
} from "@cortex/plugin-host-core"
import { bundledPlugins } from "@cortex/plugins"
import type { BookmarkEntry, BookmarkToggleResult } from "@cortex.md/api"

import {
	answerWorkspaceRequest,
	type CollabBridgeMessage,
	createWorkspaceRequests,
	type ForwardedPlatformDomain,
	forwardedPlatformMethods,
	type WorkspaceCursor,
	type WorkspaceDocument,
	type WorkspaceFindResult,
	type WorkspaceInboundMessage,
	type WorkspaceOutboundMessage,
	type WorkspaceServiceCall,
	type WorkspaceState,
} from "@/features/workspace/workspaceProtocol"

/** The single editor of the workspace WebView, registered by `WorkspaceWebView`. */
export interface WorkspaceEditorHandlers {
	openDocument(document: WorkspaceDocument): void
	closeDocument(filePath: string): Promise<void>
	showEditor(visible: boolean): void
	setBottomInset(value: number): void
	flushPendingCommit(): Promise<void>
	getFilePath(): string | null
	runCommand(commandId: string, payload: JsonValue | undefined): void
	find(query: string, direction: "next" | "prev" | undefined): Promise<WorkspaceFindResult>
	collab(message: CollabBridgeMessage): void
}

type ForwardedMethod<Domain extends ForwardedPlatformDomain> =
	(typeof forwardedPlatformMethods)[Domain][number]

export function createWorkspaceRealm() {
	const requests = createWorkspaceRequests()
	const stateListeners = new Set<() => void>()
	const watchListeners = new Map<number, (event: WatchEvent) => void>()
	const styleElements = new Map<string, HTMLStyleElement>()
	let sender: ((message: WorkspaceOutboundMessage) => void) | null = null
	let editor: WorkspaceEditorHandlers | null = null
	let hostMirror: PluginHostMirror | null = null
	let state: WorkspaceState | null = null
	let nativeQueue: Promise<void> = Promise.resolve()
	let pluginVaultPath: string | null | undefined
	let pluginAllowCommunity: boolean | undefined
	let pluginLoading: Promise<void> = Promise.resolve()

	function send(message: WorkspaceOutboundMessage): void {
		if (!sender) throw new Error("The workspace WebView is not connected")
		sender(message)
	}

	function requestNative<T>(build: (id: number) => WorkspaceOutboundMessage): Promise<T> {
		return requests.request<T>((id) => send(build(id)))
	}

	function afterPendingCommit<T>(run: () => Promise<T>): Promise<T> {
		const flushed = nativeQueue.then(() => editor?.flushPendingCommit())
		nativeQueue = flushed
		return flushed.then(run)
	}

	function callPlatform(domain: string, method: string, args: unknown[]): Promise<unknown> {
		return afterPendingCommit(() =>
			requestNative((id) => ({ type: "platformCall", id, domain, method, args })),
		)
	}

	function callService<T>(call: WorkspaceServiceCall): Promise<T> {
		return afterPendingCommit(() => requestNative<T>((id) => ({ type: "serviceCall", id, call })))
	}

	function fireService(call: WorkspaceServiceCall): void {
		callService(call).catch((error: unknown) =>
			reportPluginOperationError(call.kind, "workspace", error),
		)
	}

	function forwardDomain<Domain extends ForwardedPlatformDomain>(
		domain: Domain,
	): Pick<Platform[Domain], ForwardedMethod<Domain> & keyof Platform[Domain]> {
		const methods: readonly string[] = forwardedPlatformMethods[domain]
		return Object.fromEntries(
			methods.map((method) => [method, (...args: unknown[]) => callPlatform(domain, method, args)]),
		) as Pick<Platform[Domain], ForwardedMethod<Domain> & keyof Platform[Domain]>
	}

	function unavailable(name: string) {
		return () => {
			throw new Error(`platform.${name} is not available in the workspace WebView`)
		}
	}

	function unavailableDomain<Domain extends keyof Platform>(domain: Domain): Platform[Domain] {
		return new Proxy(
			{},
			{ get: (_target, method) => unavailable(`${domain}.${String(method)}`) },
		) as Platform[Domain]
	}

	function unavailableWindowDomain(): Platform["window"] {
		const methods: (keyof Platform["window"])[] = [
			"closeCurrent",
			"focusMain",
			"restartApp",
			"openSettings",
			"setColorScheme",
			"relay",
			"openVaultWindow",
			"openNewWindow",
			"claimVault",
			"releaseVault",
			"markReady",
			"claimOnce",
			"onMessage",
		]
		return Object.fromEntries(
			methods.map((method) => [method, unavailable(`window.${method}`)]),
		) as unknown as Platform["window"]
	}

	const hasCapability = (capability: WorkspaceState["capabilities"][number]) =>
		state?.capabilities.includes(capability) === true

	const platform: Platform = {
		get capabilities() {
			return state?.capabilities ?? []
		},
		fs: {
			...forwardDomain("fs"),
			writeBinaryFile: unavailable("fs.writeBinaryFile"),
			downloadFile: unavailable("fs.downloadFile"),
			downloadAndExtract: unavailable("fs.downloadAndExtract"),
			async startWatching(path, callback, options) {
				let watchId = 0
				await requestNative((id) => {
					watchId = id
					watchListeners.set(id, callback)
					return { type: "serviceCall", id, call: { kind: "watch", path, options } }
				}).catch((error: unknown) => {
					watchListeners.delete(watchId)
					throw error
				})
				return () => {
					watchListeners.delete(watchId)
					fireService({ kind: "unwatch", watchId })
				}
			},
		},
		notifications: {
			...forwardDomain("notifications"),
			getCapabilities: () => ({
				supported: hasCapability("notifications"),
				icons: hasCapability("notifications:icons"),
				sounds: hasCapability("notifications:sounds"),
				actions: hasCapability("notifications:actions"),
			}),
		},
		app: {
			...forwardDomain("app"),
			resolveFileAssetUrl: unavailable("app.resolveFileAssetUrl"),
			onDeepLinkOpen: unavailable("app.onDeepLinkOpen"),
			onNativeEvent: unavailable("app.onNativeEvent"),
		},
		clipboard: forwardDomain("clipboard"),
		collab: {
			availability: async () => "unsupported",
			open: unavailable("collab.open"),
			setFileSyncRole: async () => {},
		},
		appearance: unavailableDomain("appearance"),
		window: {
			...unavailableWindowDomain(),
			claimVault: async () => "claimed",
			releaseVault: async () => {},
		},
		menu: { setState: async () => {} },
		dialog: unavailableDomain("dialog"),
		storage: unavailableDomain("storage"),
		vault: unavailableDomain("vault"),
		appUpdates: unavailableDomain("appUpdates"),
		font: unavailableDomain("font"),
		http: unavailableDomain("http"),
		keychain: unavailableDomain("keychain"),
		device: unavailableDomain("device"),
		auth: unavailableDomain("auth"),
		account: unavailableDomain("account"),
		subscription: unavailableDomain("subscription"),
		sync: unavailableDomain("sync"),
		remoteVault: unavailableDomain("remoteVault"),
		members: unavailableDomain("members"),
		shares: unavailableDomain("shares"),
		devices: unavailableDomain("devices"),
	}

	function subscribeState<Key extends keyof WorkspaceState>(
		key: Key,
		callback: (value: WorkspaceState[Key]) => void,
	): () => void {
		let previous = state?.[key]
		const listener = () => {
			if (!state || state[key] === previous) return
			previous = state[key]
			callback(state[key])
		}
		stateListeners.add(listener)
		return () => {
			stateListeners.delete(listener)
		}
	}

	function publishCommunityStyles(): void {
		if (!sender) return
		const css = Array.from(styleElements.values(), (element) => element.textContent).join("\n")
		send({ type: "communityStyles", css })
	}

	function removeStyle(pluginId: string): void {
		styleElements.get(pluginId)?.remove()
		styleElements.delete(pluginId)
	}

	const styles: PluginMarkdownStyleHost = {
		install(pluginId, css) {
			removeStyle(pluginId)
			if (css) {
				const element = document.createElement("style")
				element.dataset.cortexPluginStyle = pluginId
				element.textContent = css
				document.head.append(element)
				styleElements.set(pluginId, element)
			}
			publishCommunityStyles()
		},
		remove(pluginId) {
			if (!styleElements.has(pluginId)) return
			removeStyle(pluginId)
			publishCommunityStyles()
		},
	}

	const services: PluginHostServices = {
		getVaultPath: () => state?.vaultPath ?? null,
		workspace: {
			openFile: (path) => fireService({ kind: "openFile", path }),
			openView: (viewKey) => fireService({ kind: "openView", viewKey }),
			openMarkdownTab: (pluginId, tab, options) =>
				fireService({ kind: "openMarkdownTab", pluginId, tab, options }),
			getOpenFiles: () => state?.openFiles ?? [],
			subscribeActiveFile: (callback) => subscribeState("activeFilePath", callback),
		},
		activeEditor: createCodeMirrorActiveEditor({
			getFilePath: () => editor?.getFilePath() ?? null,
		}),
		editorRuntime: pluginEditorRuntime,
		bookmarks: {
			list: () => state?.bookmarks ?? [],
			add: (path) => callService<BookmarkEntry | null>({ kind: "bookmark", action: "add", path }),
			remove: (path) =>
				callService<void>({ kind: "bookmark", action: "remove", path }).then(() => {}),
			toggle: (path, force) =>
				callService<BookmarkToggleResult>({ kind: "bookmark", action: "toggle", path, force }),
			isBookmarked: (path) =>
				state?.bookmarkedPaths[requireBookmarkPath(state?.vaultPath, path).bookmarkPath] === true,
			subscribe: (callback) => subscribeState("bookmarks", callback),
		},
		metadata: {
			parseFrontmatter: (content) =>
				parseFrontmatter(content).frontmatter as Record<string, unknown> | null,
			extractTags: extractAllTags,
			getAllTags: () => state?.tags ?? [],
		},
		theme: {
			getActiveThemeName: () => state?.themeName ?? "",
			subscribe: (callback) => subscribeState("themeName", callback),
		},
		community: {
			styles,
			loadEditorExternals: loadCodeMirrorCommunityPluginExternals,
			isAllowed: () => state?.allowCommunityPlugins === true,
		},
	}

	initPlatform(platform)
	const host = createPluginHost(services)
	host.registerBundledPlugins(bundledPlugins)

	function queuePluginLoad(load: () => Promise<void>): void {
		pluginLoading = pluginLoading
			.then(load)
			.catch((error: unknown) => reportPluginOperationError("load-enabled", "registry", error))
	}

	async function loadVaultPlugins(): Promise<void> {
		await host.disableAllPlugins()
		for (const [pluginId, record] of Object.entries(usePluginStore.getState().plugins)) {
			if (record.community) host.unregisterCommunityPlugin(pluginId)
		}
		const pluginsDir = host.getCommunityPluginsDir()
		if (!pluginsDir) return
		await host.discoverCommunityPlugins(pluginsDir)
		await host.loadEnabledPlugins()
	}

	function applyState(patch: Partial<WorkspaceState>): void {
		state = state ? { ...state, ...patch } : (patch as WorkspaceState)
		for (const listener of stateListeners) listener()
		const vaultChanged = state.vaultPath !== pluginVaultPath
		const accessChanged = state.allowCommunityPlugins !== pluginAllowCommunity
		pluginVaultPath = state.vaultPath
		pluginAllowCommunity = state.allowCommunityPlugins
		if (vaultChanged) queuePluginLoad(loadVaultPlugins)
		else if (accessChanged) queuePluginLoad(() => host.syncCommunityAccess())
	}

	return {
		connect(
			nextSender: (message: WorkspaceOutboundMessage) => void,
			handlers: WorkspaceEditorHandlers,
		): () => void {
			sender = nextSender
			editor = handlers
			send({ type: "ready" })
			hostMirror = createPluginHostMirror(host, (message) => send({ type: "plugin", message }))
			publishCommunityStyles()
			return () => {
				hostMirror?.dispose()
				hostMirror = null
				sender = null
				editor = null
				requests.rejectAll("The workspace WebView disconnected")
			}
		},
		receive(message: WorkspaceInboundMessage): void {
			switch (message.type) {
				case "plugin":
					hostMirror?.receive(message.message)
					return
				case "state":
					applyState(message.patch)
					return
				case "openDocument":
					editor?.openDocument(message.document)
					return
				case "closeDocument":
					answerWorkspaceRequest(message.id, () => editor?.closeDocument(message.filePath), send)
					return
				case "showEditor":
					editor?.showEditor(message.visible)
					return
				case "bottomInset":
					editor?.setBottomInset(message.value)
					return
				case "flush":
					answerWorkspaceRequest(message.id, () => editor?.flushPendingCommit(), send)
					return
				case "watchEvent":
					watchListeners.get(message.watchId)?.(message.event)
					return
				case "command":
					editor?.runCommand(message.commandId, message.payload)
					return
				case "collab":
					editor?.collab(message.message)
					return
				case "find":
					answerWorkspaceRequest(
						message.id,
						() => editor?.find(message.query, message.direction) ?? { current: 0, total: 0 },
						send,
					)
					return
				case "reply":
					requests.settle(message)
			}
		},
		getState: () => state,
		subscribe(listener: () => void): () => void {
			stateListeners.add(listener)
			return () => {
				stateListeners.delete(listener)
			}
		},
		commit(filePath: string, body: string, revision: number): Promise<void> {
			return requestNative((id) => ({ type: "commit", id, filePath, body, revision }))
		},
		saveImage(filePath: string, mimeType: string, base64: string): Promise<string | null> {
			return callService<string | null>({ kind: "saveImage", filePath, mimeType, base64 })
		},
		sendCollab(message: CollabBridgeMessage): void {
			send({ type: "collab", message })
		},
		reportCursor(cursor: WorkspaceCursor): void {
			send({ type: "cursor", cursor })
		},
		resolveAssetUrl(path: string): Promise<string> {
			return requestNative((id) => ({
				type: "platformCall",
				id,
				domain: "app",
				method: "resolveFileAssetUrl",
				args: [path],
			}))
		},
		executeNativeCommand(commandId: string, payload: JsonValue = null): Promise<void> {
			return afterPendingCommit(async () => send({ type: "command", commandId, payload }))
		},
	}
}

export type WorkspaceRealm = ReturnType<typeof createWorkspaceRealm>
