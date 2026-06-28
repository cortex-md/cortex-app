export type SyncEngineState =
	| "idle"
	| "authenticating"
	| "connecting"
	| "syncing"
	| "live"
	| "offline"
	| "recovering"
	| "denied"

export type SyncAccessDeniedKind = "vault" | "subscription"
export type SyncAccessDeniedCode = "subscription_required" | "subscription_expired"

export interface SyncStateEvent {
	state: SyncEngineState
}

export interface SyncAccessDeniedEvent {
	reason: string
	kind: SyncAccessDeniedKind
	code?: SyncAccessDeniedCode
}

export interface SyncFileEvent {
	path: string
	status: string
}

export type ConflictResolution =
	| { type: "keep_local" }
	| { type: "keep_remote" }
	| { type: "merged"; content: string }

export interface ConflictInfo {
	filePath: string
	localHash: string
	remoteHash: string
	ancestorHash: string | null
	localContent: string | null
	remoteContent: string | null
}

export interface InitialSyncProgressEvent {
	total: number
	completed: number
	phase: string
}

export interface SyncConflictEvent {
	path: string
}

export interface VersionInfo {
	snapshotId: string
	version: number
	sizeBytes: number | null
	checksum: string | null
	authorId: string | null
	authorName: string | null
	deviceId: string | null
	deviceName: string | null
	createdAt: string | null
}

export interface NoteSyncMetadata {
	createdAt: string | null
	createdBy: string | null
	lastEditedAt: string | null
	lastEditedBy: string | null
	lastDeviceId: string | null
	synced: boolean
}

export interface DeletedFileInfo {
	filePath: string
	version: number
	sizeBytes: number | null
	checksum: string | null
	contentType: string | null
	deletedAt: string | null
	lastModifiedBy: string | null
	lastDeviceId: string | null
}

export interface VaultEncryptionStatus {
	hasKey: boolean
}

export interface SyncPreferences {
	syncSettings: boolean
	syncHotkeys: boolean
	syncWorkspace: boolean
	syncPluginMetadata: boolean
	syncThemeMetadata: boolean
	syncBookmarks: boolean
	ignoreImages: boolean
	excludedPaths: string[]
}

export interface Sync {
	updateSyncPreferences(preferences: SyncPreferences): Promise<void>
	checkVaultEncryption(vaultId: string): Promise<VaultEncryptionStatus>
	createVaultKey(vaultId: string, password: string): Promise<void>
	unlockVaultKey(vaultId: string, password: string): Promise<void>
	start(
		vaultId: string,
		vaultPath: string,
		serverUrl: string,
		requiresEntitlement: boolean,
	): Promise<void>
	stop(): Promise<void>
	forceSyncFile(path: string): Promise<void>
	resolveConflict(path: string, resolution: ConflictResolution): Promise<void>
	getConflicts(vaultId: string, vaultPath: string): Promise<ConflictInfo[]>
	getVersionHistory(vaultId: string, vaultPath: string, filePath: string): Promise<VersionInfo[]>
	getNoteMetadata(vaultPath: string, filePath: string): Promise<NoteSyncMetadata | null>
	downloadVersion(
		vaultId: string,
		vaultPath: string,
		filePath: string,
		version: string,
	): Promise<string>
	restoreVersion(
		vaultId: string,
		vaultPath: string,
		filePath: string,
		version: string,
	): Promise<void>
	listDeletedFiles(vaultId: string, vaultPath: string): Promise<DeletedFileInfo[]>
	restoreDeletedFile(vaultId: string, vaultPath: string, filePath: string): Promise<void>
	onStateChanged(callback: (event: SyncStateEvent) => void): Promise<() => void>
	onFileEvent(callback: (event: SyncFileEvent) => void): Promise<() => void>
	onInitialSyncProgress(callback: (event: InitialSyncProgressEvent) => void): Promise<() => void>
	onConflict(callback: (event: SyncConflictEvent) => void): Promise<() => void>
	onInitialSyncComplete(callback: () => void): Promise<() => void>
	onVekRequired(callback: () => void): Promise<() => void>
	onVaultAccessDenied(callback: (event: SyncAccessDeniedEvent) => void): Promise<() => void>
	onSyncLog(callback: (event: { level: string; message: string }) => void): Promise<() => void>
}
