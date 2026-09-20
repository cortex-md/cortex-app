export {
	type AuthStatus,
	type CurrentUser,
	type DeviceInfoLike,
	getAuthStatus,
	getCurrentUser,
	type LoginResponse,
	login,
	logout,
	type RegisterResponse,
	register,
} from "./auth"
export {
	type AutoMergeResult,
	type ConflictInfo,
	ConflictResolver,
	DetectResult,
	detect,
} from "./conflict"
export {
	decrypt,
	decryptVek,
	deriveKeyFromPassword,
	encrypt,
	encryptVek,
	generateSalt,
	generateVek,
	loadVek,
	storeVek,
} from "./crypto"
export { type NoteSyncMetadata, type QueueRow, SyncDb, type SyncStateRow } from "./db"
export {
	type DeletedFileInfo,
	Downloader,
	type DownloadResult,
	type VersionInfo,
} from "./downloader"
export { SyncEngine, type SyncEngineDeps, type SyncEngineEventEmitter } from "./engine"
export { hashContent } from "./hash"
export {
	clearTokensAndUserInfoForServer,
	clearTokensForServer,
	type DeviceLike,
	getAccessTokenForServer,
	getRefreshTokenForServer,
	getUserForServer,
	hasTokensForServer,
	isSubscriptionAccessError,
	type KeychainLike,
	normalizeServerUrl,
	parseResponse,
	SyncHttpClient,
	type SyncHttpClientOptions,
	type SyncHttpResponse,
	scopedKey,
	storeTokensForServer,
	storeUserForServer,
	subscriptionAccessMessage,
	subscriptionCodeFromText,
} from "./http"
export {
	defaultSyncPreferences,
	isImagePath,
	type SyncPreferences,
	shouldIgnorePath,
} from "./ignore"
export { computeInitialActions, InitialSync, type InitialSyncProgress } from "./initial"
export {
	type BinaryWinner,
	isBinary,
	isJsonConfig,
	isMarkdown,
	type MergeResult,
	mergeBinary,
	mergeJson,
	mergeMarkdown,
} from "./merge"
export { normalizePathSeparators, normalizeRelativePath, toVaultRelativePath } from "./paths"
export {
	type QueueItem,
	retryBackoffSecs,
	type SyncOp,
	SyncQueue,
} from "./queue"
export {
	computeFullReconcileActions,
	eventsToActions,
	Reconciler,
} from "./reconcile"
export { SseClient, type SseFileEvent, type SyncCommandSink } from "./sse"
export {
	type ConflictResolution,
	type ConnectionMode,
	isRetriableSyncErrorMessage,
	type SyncCommand,
	type SyncEngineState,
	SyncError,
} from "./state"
export { Uploader } from "./uploader"
