export { setBookmarksFunctions } from "./apis/BookmarksAPI"
export {
	type CommandEntry,
	type CommandIcon,
	executeCommand,
	getCommands,
	registerCommand,
} from "./apis/CommandsAPI"
export {
	getEditorViewRef,
	setEditorContextFunctions,
	setEditorViewRef,
	setReconfigurePluginExtensions,
} from "./apis/EditorAPI"
export { setMetadataFunctions } from "./apis/MetadataAPI"
export { resetNotificationRateLimits, setNotificationFunctions } from "./apis/NotificationsAPI"
export { setThemeManagerRef } from "./apis/ThemeAPI"
export { setWorkspaceFunctions } from "./apis/WorkspaceAPI"
export {
	pluginApiCapabilityRequirements,
	pluginHasCapability,
	requirePluginCapability,
	validatePluginManifestCapabilities,
} from "./manifestCapabilities"

export {
	type CommunityPluginEntry,
	type CommunityPluginRegistration,
	clearCommunityPluginRegistration,
	disableAllPlugins,
	disablePlugin,
	enablePlugin,
	getCommunityPluginEntries,
	getCommunityPluginLoadError,
	getEnabledCommunityPluginEntries,
	getPluginInstance,
	loadEnabledPlugins,
	type PluginConstructor,
	type PluginModule,
	registerBundledPlugin,
	registerCommunityPlugin,
	runPluginLifecycleInOrder,
	saveEnabledPlugins,
	setCommunityPluginLoadError,
	unregisterCommunityPlugin,
} from "./PluginLifecycle"
export type {
	PluginModalInstance,
	PluginRecord,
	PluginRegistrationOwner,
	PluginStatus,
	PluginStoreState,
	RegisteredContextMenuItem,
	RegisteredPluginView,
	RegisteredSettingsTab,
	RegisteredSidebarItem,
	RegisteredStatusBarItem,
} from "./pluginStore"
export { getPluginRegistrationKey, pluginStore } from "./pluginStore"
export {
	installPluginMarkdownStyles,
	type PluginMarkdownStyleHost,
	removePluginMarkdownStyles,
	scopePluginMarkdownStyles,
	setPluginMarkdownStyleHost,
} from "./pluginStyles"
