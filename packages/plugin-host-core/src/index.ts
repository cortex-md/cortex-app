export { createCodeMirrorActiveEditor } from "./activeEditor"
export { createPluginHostMirror, type PluginHostMirror } from "./bridge/hostMirror"
export type {
	JsonValue,
	PluginControlRequest,
	PluginHostMessage,
	PluginInvokeRequest,
	PluginUiMessage,
	PluginViewUpdateMessage,
	RemoteViewSnapshot,
	SerializedPluginDefinition,
} from "./bridge/protocol"
export { serializePluginDefinition } from "./bridge/protocol"
export type { RemoteViewRuntime } from "./bridge/remoteView"
export { createPluginUiMirror, type PluginHostFacade, type PluginUiMirror } from "./bridge/uiMirror"
export { reportPluginOperationError } from "./communityPlugins"
export { type PluginContextMenuAction, selectContextMenuItems } from "./contextMenuItems"
export {
	type EditorViewLike,
	getEditorViewRef,
	registerEditorView,
	setEditorViewRef,
} from "./editorViews"
export {
	type ActiveEditorService,
	type CommunityPluginServices,
	type EditorContributionSnapshot,
	type PluginHostServices,
	type RegisteredEditorFoldProvider,
	resetNotificationRateLimits,
} from "./pluginContext"
export { createPluginHost, type PluginHost } from "./pluginHost"
export {
	CORE_OWNER,
	type ContributionIcon,
	type ContributionSet,
	clearOwnerContributions,
	closeModal,
	getContributionKey,
	type PluginModalInstance,
	type PluginRecord,
	type PluginStatus,
	type PluginStoreState,
	type RegisteredContextMenuItem,
	type RegisteredSettingsPage,
	type RegisteredSidebarItem,
	type RegisteredStatusBarItem,
	type RegisteredView,
	registerContributions,
	resetPluginStore,
	updateModalState,
	usePluginStore,
} from "./pluginStore"
export type { PluginMarkdownStyleHost } from "./pluginStyles"
export {
	type ControlledPluginViewState,
	createPluginViewController,
	type PluginViewController,
	type PluginViewSnapshot,
} from "./pluginViewController"
export { type PluginSettingField, resolvePluginSettingFields } from "./settingFields"
export { selectVisibleStatusBarItems } from "./statusBarItems"
