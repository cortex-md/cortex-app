import {
	extractAllTags,
	normalizeBookmarkPath,
	parseFrontmatter,
	useBookmarksStore,
	useEditorStore,
	useTagsStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { reconfigurePluginExtensions } from "@cortex/editor/extensions"
import { loadCodeMirrorCommunityPluginExternals } from "@cortex/editor/runtime"
import { setMarketplaceCallbacks } from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
import GitHubEmojiPlugin from "@cortex/plugin-github-emoji"
import {
	pluginStore,
	registerBundledPlugin,
	setBookmarksFunctions,
	setEditorContextFunctions,
	setMetadataFunctions,
	setNotificationFunctions,
	setReconfigurePluginExtensions,
	setThemeManagerRef,
	setWorkspaceFunctions,
} from "@cortex/plugin-host-core"
import {
	installWebPluginMarkdownStyleHost,
	reloadCommunityPlugins,
	setCodeMirrorExternalLoader,
	setSettingsControls,
} from "@cortex/plugin-host-web"
import { getThemeManager } from "@cortex/theme"
import { desktopSettingsControls } from "../features/settings/desktopSettingsControls"
import { reloadCommunityThemes } from "../features/themes/communityThemeLoader"
import { sendCoreNotification } from "../utils/nativeNotifications"
import { initializeCommandHotkeyBridge } from "./commandHotkeyBridge"
import { getWorkspaceOpenTabOptions, openPluginMarkdownTab } from "./workspaceBridge"

function getOpenVaultPath(): string {
	const vaultPath = useVaultStore.getState().vault?.path
	if (!vaultPath) throw new Error("No vault is open")
	return vaultPath
}

function getPluginBookmarkPath(vaultPath: string, path: string): string {
	const bookmarkPath = normalizeBookmarkPath(vaultPath, path)
	if (!bookmarkPath) {
		throw new Error("Bookmarks only support Markdown files inside the active vault")
	}
	return bookmarkPath
}

export function initializePluginBridges(): void {
	initializeCommandHotkeyBridge()
	installWebPluginMarkdownStyleHost()
	setReconfigurePluginExtensions(reconfigurePluginExtensions as never)
	setCodeMirrorExternalLoader(loadCodeMirrorCommunityPluginExternals)
	setSettingsControls(desktopSettingsControls)
	setThemeManagerRef(getThemeManager())
	setEditorContextFunctions({
		getActiveFilePath: () => useEditorStore.getState().activeFilePath,
		getActiveFileContent: () => null,
	})
	setMetadataFunctions({
		parseFrontmatter: (content) => parseFrontmatter(content),
		extractAllTags,
		getAllTags: () => useTagsStore.getState().getAllTags(),
		readFile: async (path) => {
			const vault = useVaultStore.getState().vault
			if (!vault) throw new Error("No vault is open")
			return getPlatform().fs.readFile(`${vault.path}/${path}`)
		},
	})
	setNotificationFunctions({
		isSupported: () => getPlatform().capabilities.includes("notifications"),
		getPermission: () => getPlatform().notifications.getPermission(),
		send: (notification) =>
			getPlatform().notifications.send({
				...notification,
				id: notification.id ? `${notification.pluginId}:${notification.id}` : undefined,
				tag: notification.tag ? `${notification.pluginId}:${notification.tag}` : undefined,
				source: "plugin",
				pluginId: notification.pluginId,
			}),
	})
	setBookmarksFunctions({
		list: () => useBookmarksStore.getState().bookmarks,
		add: (path) => {
			const vaultPath = getOpenVaultPath()
			return useBookmarksStore
				.getState()
				.addBookmark(vaultPath, getPluginBookmarkPath(vaultPath, path))
		},
		remove: (path) => {
			const vaultPath = getOpenVaultPath()
			return useBookmarksStore
				.getState()
				.removeBookmark(vaultPath, getPluginBookmarkPath(vaultPath, path))
		},
		toggle: (path, force) => {
			const vaultPath = getOpenVaultPath()
			return useBookmarksStore
				.getState()
				.toggleBookmark(vaultPath, getPluginBookmarkPath(vaultPath, path), force)
		},
		isBookmarked: (path) => {
			const vaultPath = getOpenVaultPath()
			return useBookmarksStore
				.getState()
				.isBookmarked(vaultPath, getPluginBookmarkPath(vaultPath, path))
		},
		subscribe: (callback) =>
			useBookmarksStore.subscribe((state, previousState) => {
				if (state.bookmarks !== previousState.bookmarks) callback(state.bookmarks)
			}),
	})
	setWorkspaceFunctions({
		openFile: (path, options) => {
			useWorkspaceStore.getState().openTab(path, getWorkspaceOpenTabOptions(options))
		},
		openView: (pluginId, viewId, options) => {
			const registration = pluginStore
				.getState()
				.views.find((view) => view.pluginId === pluginId && view.id === viewId)
			if (!registration) return
			useWorkspaceStore
				.getState()
				.openViewTab(
					registration.registrationKey,
					registration.label,
					getWorkspaceOpenTabOptions(options),
				)
		},
		openMarkdownTab: openPluginMarkdownTab,
		getOpenFiles: () =>
			Object.values(useWorkspaceStore.getState().panes).flatMap((pane) =>
				pane.tabs.flatMap((tab) => (tab.tabType === "file" ? [tab.filePath] : [])),
			),
		subscribeActiveFile: (callback) =>
			useEditorStore.subscribe((state, previousState) => {
				if (state.activeFilePath !== previousState.activeFilePath) {
					callback(state.activeFilePath)
				}
			}),
	})
	setMarketplaceCallbacks({
		getPluginsDir: () => {
			const vault = useVaultStore.getState().vault
			return vault ? `${vault.path}/.cortex/plugins` : null
		},
		getThemesDir: () => {
			const vault = useVaultStore.getState().vault
			return vault ? `${vault.path}/.cortex/themes` : null
		},
		reloadPluginHost: async (directory) => {
			await reloadCommunityPlugins(directory, () => useVaultStore.getState().vault?.path ?? null)
		},
		reloadThemes: reloadCommunityThemes,
		isPluginInstalled: (id) => id in pluginStore.getState().plugins,
		isThemeInstalled: (id) =>
			getThemeManager()
				.getThemeFamilies()
				.some((family) => family.name === id),
		notify: (event) => {
			void sendCoreNotification({
				id: `marketplace:${event.action}:${event.kind}:${event.entryId}`,
				tag: `marketplace:${event.kind}:${event.entryId}`,
				title: event.title,
				body: event.body,
				kind: event.level,
				urgency: event.level === "error" ? "high" : "normal",
			})
		},
	})
	registerBundledPlugin(
		{
			id: "github-emoji",
			name: "GitHub Emoji",
			version: "0.1.0",
			minAppVersion: "0.1.0",
			author: "Cortex",
			description: "Convert :emoji_code: to emoji characters in the editor",
			icon: "smile",
			main: "index.ts",
			capabilities: [
				"markdown:extensions",
				"ui:views",
				"ui:sidebar",
				"ui:statusbar",
				"settings",
				"commands",
				"editor:write",
				"notifications",
			],
		},
		{ default: GitHubEmojiPlugin },
	)
}
