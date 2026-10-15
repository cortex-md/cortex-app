export {
	ensureMarkdownExtension,
	type FileFingerprint,
	getBaseName,
	getExtension,
	getNoteTitle,
	getParentPath,
	getRelativePath,
	getVaultFilePath,
	isMarkdownPath,
	isPathOrDescendant,
	isPdfPath,
	joinPath,
	mapWithConcurrency,
	normalizePath,
	replacePathPrefix,
	splitExtension,
	stripMarkdownExtension,
	toVaultRelativePath,
	VAULT_CONFIG_DIR,
	VAULT_FILES,
} from "@cortex/platform/utils"
export {
	type CollabNoteBinding,
	type CollabNoteState,
	getCollabNoteState,
	retainCollabNote,
	subscribeCollabNotes,
} from "./collab/collabRuntime"
export { useCollabNote, useCollabNoteState } from "./collab/useCollabNote"
export {
	type InviteDeepLink,
	parseInviteDeepLink,
	startInviteDeepLinks,
} from "./deepLinks/inviteDeepLink"
export {
	parseResetPasswordDeepLink,
	type ResetPasswordTarget,
	startResetPasswordDeepLinks,
} from "./deepLinks/resetPasswordDeepLink"
export {
	parseSharedNoteDeepLink,
	type SharedNoteDeepLink,
	startSharedNoteDeepLinks,
} from "./deepLinks/sharedNoteDeepLink"
export {
	parseTemplateDeepLink,
	startTemplateDeepLinks,
	TEMPLATE_LINK_ENTRY_PREFIX,
} from "./deepLinks/templateDeepLink"
export {
	buildSyncActorNames,
	computeVersionDeltas,
	type SyncActorNames,
	VERSION_PREFETCH_CONCURRENCY,
	VERSION_PREFETCH_LIMIT,
} from "./history/historyActors"
export {
	buildEntries as buildHistoryEntries,
	CURRENT_ENTRY as CURRENT_HISTORY_ENTRY,
	compareEntries as compareHistoryEntries,
	copyName as historyVersionCopyName,
	type HistoryEntry,
} from "./history/historyEntries"
export { groupByDay, historyDayLabel, parseTimestamp } from "./history/historyTime"
export {
	captureLocalVersion,
	LOCAL_HISTORY_SIZE_CAP_BYTES,
	type LocalVersion,
	type LocalVersionReason,
	listLocalVersions,
	readLocalVersion,
} from "./history/localHistory"
export {
	captureCurrentNoteVersion,
	readCurrentNoteContent,
	restoreLocalVersion,
} from "./history/restoreLocalVersion"
export {
	type ExternalChangeEvent,
	type LiveDocumentHandler,
	type LiveWriteOptions,
	type NoteCacheEntry,
	noteCache,
	type Snapshot,
	type SnapshotTrigger,
} from "./noteCache"
export { extractHeadings, findActiveHeadingIndex, type NoteHeading } from "./notes/outline"
export { openNoteAtLine, openWikiLink, resolveWikiLink } from "./notes/wikiLinks"
export {
	createCoreServices,
	getWorkspaceOpenTabOptions,
	openPluginMarkdownTab,
	PLUGIN_MARKDOWN_NOTE_VIEW_ID,
} from "./pluginHostServices"
export {
	buildRemoteVaultOptions,
	createVaultFolder,
	describeRemoteVault,
	getDefaultVaultLocation,
	leaveRemoteVault,
	linkVaultFolder,
	loadVaultListItems,
	type RegisterVaultFolderOptions,
	type RemoteVaultOption,
	registerVaultFolder,
	resolveVaultColor,
	resolveVaultListStatus,
	unlinkVaultFolder,
	VAULT_COLORS,
	type VaultListItem,
	type VaultListStatus,
} from "./runtime/addVault"
export {
	ADD_VAULT_FIRST_STEP,
	ADD_VAULT_STEP_LABELS,
	type AddVaultDraft,
	type AddVaultFlow,
	type AddVaultFlowDeps,
	type AddVaultNames,
	type AddVaultOpenOptions,
	type AddVaultPath,
	type AddVaultStep,
	type AddVaultTarget,
	addVaultStepsFor,
	createAddVaultDraft,
	createAddVaultFlow,
	NEW_REMOTE,
	type PickedFolderInfo,
	resolveAddVaultNames,
	type SyncMode,
} from "./runtime/addVaultFlow"
export {
	type AppRuntimeOptions,
	canStartSync,
	type SyncStartInput,
	startAppRuntime,
	startSyncLifecycle,
	type VaultIndexingMode,
} from "./runtime/appRuntime"
export {
	bootstrapApp,
	flushPendingWrites,
	openLastVault,
	resolveStartupVault,
	type StartupVaultInput,
} from "./runtime/appStartup"
export {
	resolveCommentMentions,
	startCommentsRuntime,
	toMentionCandidates,
} from "./runtime/commentsRuntime"
export {
	type CreateDatabaseInput,
	type CreateDatabaseRowInput,
	type CreatedDatabase,
	convertFolderToDatabase,
	createDatabase,
	createDatabaseRow,
	deleteDatabaseRows,
	exportDatabasePreset,
	flushDatabaseConfigWrites,
	getDatabaseQueryContext,
	removeDatabase,
	removeDatabaseRowTemplate,
	saveDatabaseRowTemplate,
	updateDatabaseCell,
	updateDatabaseConfig,
} from "./runtime/databaseActions"
export { createDatabaseCommandEntries, DATABASE_COMMAND_IDS } from "./runtime/databaseCommands"
export {
	applyDatabaseRowContent,
	isDatabaseRetained,
	retainDatabase,
} from "./runtime/databaseRuntime"
export {
	addDatabaseView,
	createDatabaseRowInView,
	cycleDatabaseViewSort,
	removeDatabaseView,
	renameDatabaseFolder,
	renameDatabaseRowNote,
	reorderDatabaseRowTitles,
	updateDatabaseView,
} from "./runtime/databaseViewActions"
export {
	DATABASE_VIEW_ID,
	type DatabaseViewState,
	openDatabaseView,
	readDatabaseViewState,
} from "./runtime/databaseWorkspace"
export {
	confirmDeleteEntry,
	createFileCommandEntries,
	createNote,
	FILE_COMMAND_IDS,
	type FileCommandHost,
	type FileEntryAction,
	type FileEntryActionId,
	type FileEntryActionTarget,
	getFileEntryActions,
} from "./runtime/fileActions"
export {
	closeNewDatabaseTab,
	NEW_DATABASE_VIEW_ID,
	type NewDatabaseViewState,
	openNewDatabaseView,
	readNewDatabaseViewState,
} from "./runtime/newDatabaseWorkspace"
export {
	type NoteDocumentSession,
	type NoteDocumentSessionOptions,
	type NoteDocumentSnapshot,
	openNoteDocumentSession,
} from "./runtime/noteDocumentSession"
export {
	createPropertiesRuntime,
	initializeCoreProperties,
	type PropertiesRuntimeOptions,
} from "./runtime/propertiesRuntime"
export {
	type SubscribeAppActive,
	startAuthSession,
	startTeamTemplatesRefresh,
	startVaultOverviewRefresh,
	teamTemplatesRefreshKey,
} from "./runtime/sessionRefresh"
export {
	addTaskFromQuickAdd,
	describeSidebarTaskTime,
	describeTaskReminder,
	getTaskSource,
	isInboxTask,
	openTaskInNote,
	openTodayView,
	readTodayViewState,
	revertTaskEditSafely,
	TODAY_VIEW_ID,
	type TodayTab,
	type TodayViewState,
	toggleTaskInNote,
	toggleTaskWithUndo,
} from "./runtime/taskActions"
export {
	applyTaskNotificationToContent,
	resolveTaskNotificationTarget,
	type TaskNotificationTarget,
} from "./runtime/taskNotificationActions"
export { planVaultReminders } from "./runtime/tasksRuntime"
export {
	addPublicNoteTemplate,
	databaseTemplateShareKey,
	getLinkedRemoteVaultId,
	listMarketTemplates,
	noteTemplateShareKey,
	type OpenedPublicTemplate,
	openPublicTemplate,
	refreshTeamTemplates,
	republishNoteTemplate,
	type SharedDatabasePreset,
	type ShareTemplateOptions,
	shareDatabaseTemplate,
	shareNoteTemplate,
	stopSharingTemplate,
	type TemplateSharingState,
	useTemplateSharingStore,
} from "./runtime/templateSharing"
export {
	getTemplateSlashItems,
	TEMPLATE_SLASH_PREFIX,
	type TemplateSlashItem,
} from "./runtime/templateSlashItems"
export {
	formatVaultPath,
	getVaultDisplayPath,
	getVaultInitial,
	getVaultStatusTitles,
} from "./runtime/vaultDisplay"
export {
	deleteImpact,
	forgetImpact,
	type ImpactCell,
	type ImpactTone,
	leaveImpact,
	unlinkImpact,
	type VaultImpact,
} from "./runtime/vaultImpacts"
export {
	type CreateVaultFromFolderOptions,
	consumePendingOnboardingNote,
	createVaultFromFolder,
	DEFAULT_VAULT_NAME,
	getDefaultVaultName,
	getRegistryOpenOptions,
	openVaultSession,
	type PickedFolder,
	resolvePickedFolder,
} from "./runtime/vaultSession"
export {
	applyVaultSettingsImport,
	type VaultSettingsImportInput,
	type VaultSettingsImportOptions,
	type VaultSettingsImportResult,
} from "./runtime/vaultSettingsImport"
export { useCanReadVaultPath, useCanWriteVaultPath } from "./stores/accessHooks"
export {
	type AccessState,
	canReadVaultPath,
	canWriteVaultPath,
	useAccessStore,
} from "./stores/accessStore"
export {
	type AccountState,
	useAccountStore,
	useServerCapabilities,
} from "./stores/accountStore"
export { type AppState, useAppStore } from "./stores/appStore"
export { type AuthState, useAuthStore } from "./stores/authStore"
export {
	BOOKMARKS_FILE,
	type BookmarkEntry,
	type BookmarksState,
	type BookmarkToggleResult,
	createBookmarkedPaths,
	normalizeBookmarkPath,
	normalizeBookmarksDocument,
	resolveBookmarkPath,
	useBookmarksStore,
} from "./stores/bookmarksStore"
export {
	type CommentAnchorRanges,
	type CommentDraft,
	type CommentRevealRequest,
	type CommentsState,
	getCommentAuthorId,
	getNoteCommentsSidecarPath,
	selectNoteComments,
	useCommentsStore,
} from "./stores/commentsStore"
export {
	type DatabaseEntry,
	type DatabaseRowsState,
	type DatabaseRowsStatus,
	type DatabaseState,
	selectDatabaseByFolder,
	selectDatabaseRows,
	selectDatabaseRowsStatus,
	selectViewNotePaths,
	useDatabaseStore,
} from "./stores/databaseStore"
export { type DevicesState, useDevicesStore } from "./stores/devicesStore"
export {
	type DragPosition,
	type DragSource,
	type DragSourceType,
	type DragState,
	type DropTarget,
	type DropTargetType,
	type DropZone,
	type FileDragSource,
	type FileTreeDropPosition,
	type SidebarViewDragSource,
	type TabDragSource,
	useDragStore,
} from "./stores/dragStore"
export {
	type CursorPosition,
	type DocumentOverview,
	type EditorMode,
	type EditorRevealRequest,
	type EditorState,
	selectActiveDocument,
	useEditorStore,
} from "./stores/editorStore"
export { type Backlink, type LinksState, selectBacklinks, useLinksStore } from "./stores/linksStore"
export { type MembersState, useMembersStore } from "./stores/membersStore"
export { type NoteSharesState, useNoteSharesStore } from "./stores/noteSharesStore"
export {
	createDefaultSyncConfig,
	normalizeSyncConfig,
	type RemoteVaultState,
	useRemoteVaultStore,
} from "./stores/remoteVaultStore"
export {
	createSubscriptionRequiredStatus,
	type SubscriptionBlock,
	type SubscriptionCacheEntry,
	type SubscriptionState,
	useSubscriptionStore,
} from "./stores/subscriptionStore"
export {
	type SyncLogEntry,
	type SyncLogLevel,
	type SyncLogState,
	useSyncLogStore,
} from "./stores/syncLogStore"
export {
	createDefaultSyncPreferences,
	isSyncImagePath,
	normalizeSyncPathPattern,
	normalizeSyncPreferences,
	type SyncState,
	shouldIgnoreSyncPath,
	useSyncStore,
} from "./stores/syncStore"
export {
	selectSortedTags,
	type TagColor,
	type TagEntry,
	type TagsState,
	useTagsStore,
} from "./stores/tagsStore"
export {
	findTaskById,
	selectAllTasks,
	type TaskLineEdit,
	type TasksState,
	useTasksStore,
} from "./stores/tasksStore"
export {
	type CreateNoteFromTemplateInput,
	type RemoteTemplateEntry,
	type TemplateDefinition,
	type TemplateInput,
	type TemplateInsertResult,
	type TemplateManifest,
	type TemplatePreview,
	type TemplateRenderContext,
	type TemplateShareLink,
	type TemplateState,
	type TemplateUpdateInput,
	type TemplateVault,
	useTemplateStore,
} from "./stores/templateStore"
export {
	clampLeftSidebarWidth,
	LEFT_SIDEBAR_WIDTH_BOUNDS,
	type LeftSidebarLayout,
	type LeftSidebarView,
	type QuickFinderRequest,
	type RightSidebarLayout,
	type RightSidebarPanel,
	type UIState,
	useUIStore,
} from "./stores/uiStore"
export {
	type OpenVaultOptions,
	subscribeVaultFileChanges,
	useVaultStore,
	type VaultFileChange,
	type VaultMetadata,
	type VaultRegistryEntry,
	type VaultState,
} from "./stores/vaultStore"
export {
	type FileTabKind,
	getRecentFilePaths,
	inferFileTabKind,
	type LeafNode,
	type OpenTabOptions,
	type Pane,
	type SplitDirection,
	type SplitNode,
	type SplitTree,
	selectActiveTab,
	selectActiveTabFilePath,
	type Tab,
	type TabType,
	useWorkspaceStore,
	type ViewTabState,
	type WorkspaceState,
} from "./stores/workspaceStore"
export {
	type AccessEvaluator,
	createAccessEvaluator,
	findAccessRule,
	findInheritedRestriction,
	normalizeAccessPath,
} from "./sync/access"
export { type BuildSharedNoteBundle, startLiveNoteShares } from "./sync/liveNoteShares"
export {
	buildSyncLogItems,
	describeSyncLogEntry,
	formatSyncLogPaths,
	groupSyncLogItems,
	type SyncLogGroup,
	type SyncLogItem,
	type SyncLogKind,
	type SyncLogPresentation,
	type SyncLogTone,
} from "./sync/logPresentation"
export { type CoreNotification, sendCoreNotification } from "./sync/nativeNotifications"
export {
	formatNoteEditedAt,
	type LoadNoteSyncAttributionOptions,
	loadNoteSyncAttribution,
	type NoteSyncAttribution,
	resolveNoteSyncAttribution,
} from "./sync/noteAttribution"
export {
	ATTACHMENT_BUDGET_BYTES,
	buildSharedNoteBundle,
	candidatePaths as sharedNoteImageCandidatePaths,
	imageType as sharedNoteImageType,
	isExternalSource as isSharedNoteExternalSource,
	readImage as readSharedNoteImage,
	type SharedNoteBundleDeps,
	toBase64 as sharedNoteBytesToBase64,
} from "./sync/noteShareBundle"
export {
	formatLastSyncedAt,
	resolveSyncIndicatorStatus,
	SYNC_STATUS_PRESENTATION,
	type SyncIndicatorInput,
	type SyncIndicatorKind,
	type SyncIndicatorStatus,
	type SyncStatusPresentation,
	type SyncStatusTone,
} from "./sync/presentation"
export {
	createSyncEnvironmentSecretKey,
	SELF_HOSTED_ENVIRONMENT_FIELDS,
	SELF_HOSTED_ENVIRONMENT_GROUPS,
	type SelfHostedEnvironmentField,
	type SelfHostedEnvironmentGroup,
	type SelfHostedEnvironmentSubsection,
	serializeSelfHostedEnvironment,
} from "./sync/selfHostedEnvironment"
export {
	BILLING_URL,
	CLOUD_SERVER_LABEL,
	DEFAULT_CLOUD_SYNC_SERVER_URL,
	DEFAULT_SELF_HOSTED_SYNC_SERVER_URL,
	DEFAULT_SYNC_SERVER_URL,
	describeServerUrl,
	getSyncServerLabel,
	normalizeServerUrl,
	requiresCloudEntitlement,
	resolveSyncServerUrl,
} from "./sync/serverConfig"
export { inlineAttachments, rewriteAttachmentLinks, SHARED_NOTE_VIEW_ID } from "./sync/sharedNote"
export {
	fromBase64 as sharedNoteBase64ToBytes,
	type SharedNoteNaming,
	saveSharedNoteCopy,
} from "./sync/sharedNoteCopy"
export { startNativeNotifications } from "./sync/syncNotifications"
export {
	createVaultKeyDraft,
	type EncryptionStep,
	VAULT_KEY_POLL_MS,
	type VaultKeyDraft,
} from "./sync/vaultKeyDraft"
export {
	createVaultKeyFlow,
	type VaultKeyFlow,
	type VaultKeyFlowOptions,
} from "./sync/vaultKeyFlow"
export type {
	SyncPluginEntry,
	SyncPluginsManifest,
	SyncThemeEntry,
	SyncThemesManifest,
} from "./types/syncMetadata"
export {
	type EntryNameKind,
	getEditableEntryName,
	getEntryNameKind,
	getNoteFolderSegments,
	getNotePathPresentation,
	getNoteTitleError,
	getPortableFileNameError,
	type NamedEntry,
	type NotePathPresentation,
	type NotePathSegment,
	toEntryFileName,
	validateEntryName,
} from "./utils/fileName"
export {
	buildFileTree,
	canMoveEntryTo,
	createFileTreeViewModel,
	type FileTreeCreateRow,
	type FileTreeNode,
	type FileTreeNodeRow,
	type FileTreeOptions,
	type FileTreeRow,
	type FileTreeViewModel,
	type FileTreeViewRow,
	type FileTreeVisibleNodeRow,
	flattenVisibleFileTree,
	getFileTreeNodeTitle,
	getMoveDestinations,
	type MovableEntry,
	type MoveDestination,
	projectVisibleFileTree,
	type VisibleFileTreeProjection,
} from "./utils/fileTree"
export { type FolderNoteCount, getFolderNoteCounts } from "./utils/folders"
export {
	addTagToFrontmatter,
	createDefaultFrontmatter,
	extractAllTags,
	extractInlineTags,
	extractYamlArray,
	type Frontmatter,
	hasFrontmatter,
	type ParsedNote,
	parseFrontmatter,
	removeTagFromFrontmatter,
	renameTagInContent,
	updateFrontmatterField,
} from "./utils/frontmatter"
export { createWikiLinkResolver, type WikiLinkResolver } from "./utils/links"
export {
	canStepNavigationHistory,
	EMPTY_NAVIGATION_HISTORY,
	isSameNavigationLocation,
	type NavigationDirection,
	type NavigationHistory,
	type NavigationLocation,
	pushNavigationLocation,
	stepNavigationHistory,
} from "./utils/navigationHistory"
export { type AppOperationError, getErrorMessage, reportAppError } from "./utils/reportAppError"
export {
	generatePluginMetadata,
	generateThemeMetadata,
	readSyncPluginMetadata,
	readSyncThemeMetadata,
	writeSyncPluginMetadata,
	writeSyncThemeMetadata,
} from "./utils/syncMetadata"
export {
	buildTagTree,
	getTagPageModel,
	isTagOrDescendant,
	type TagPageModel,
	type TagPageNote,
	type TagTreeNode,
	type TagTreeSource,
} from "./utils/tagHierarchy"
export {
	buildDiffRows,
	countWordChanges,
	type DiffLineKind,
	type DiffRow,
	type DiffSegment,
	type WordChangeCount,
} from "./utils/textDiff"
export {
	fileEntryMtimeToMs,
	formatRelativeTime,
	getFileModifiedTimes,
	type RelativeTimeStyle,
} from "./utils/time"
