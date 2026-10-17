import type {
	Account,
	AlertDialogOptions,
	AppUpdateStatus,
	AppUpdates,
	Auth,
	CollabAvailability,
	CollabChannelEvent,
	CollabFileSyncRole,
	CollabFrameOp,
	ConfirmDialogOptions,
	ContextMenuOptions,
	Device,
	Devices,
	EffectiveAccess,
	ExportHtmlToPdfOptions,
	FileDialogOptions,
	FileSystem,
	FolderDialogOptions,
	Font,
	InitialSyncProgressEvent,
	Keychain,
	KeyTrustIssue,
	Members,
	NativeAppearanceSnapshot,
	NativeMenu,
	NativeNotificationPermissionState,
	NativeNotificationRequest,
	NativeNotificationResult,
	NativeWindow,
	NotificationActivation,
	RemoteVault,
	ScheduledNotificationRequest,
	Shares,
	Subscription,
	Sync,
	SyncAccessDeniedEvent,
	SyncConflictEvent,
	SyncFileEvent,
	SyncStateEvent,
	TemplateShares,
	Vault,
	WatchEvent,
	WatchOptions,
} from "@cortex/platform"

type SyncCommands = {
	[K in keyof Sync as K extends `on${string}` ? never : K]: Sync[K]
}

export interface MainApi {
	fs: Omit<FileSystem, "startWatching" | "readBinaryFile" | "copyFile"> & {
		readBinaryFile(path: string): Promise<Uint8Array>
		copyFile(sourcePath: string, targetPath: string): Promise<void>
		startWatching(path: string, options: WatchOptions): Promise<string>
		stopWatching(watcherId: string): Promise<void>
		downloadText(url: string): Promise<string>
	}
	vault: Vault
	dialog: {
		pickFolder(options: FolderDialogOptions): Promise<string | null>
		pickFile(options: FileDialogOptions): Promise<string | null>
		pickFiles(options: FileDialogOptions): Promise<string[]>
		saveFile(options: FileDialogOptions): Promise<string | null>
		showConfirm(options: ConfirmDialogOptions): Promise<boolean>
		showAlert(options: AlertDialogOptions): Promise<void>
		revealFolder(path: string): Promise<void>
		showContextMenu(options: ContextMenuOptions): Promise<string | null>
	}
	documents: {
		exportHtmlToPdf(options: ExportHtmlToPdfOptions): Promise<void>
	}
	app: {
		getVersion(): Promise<string>
		getDataDir(): Promise<string>
		openExternalUrl(url: string): Promise<void>
		getAppearanceSnapshot(): Promise<Partial<NativeAppearanceSnapshot>>
	}
	window: NativeWindow
	menu: NativeMenu
	appUpdates: Omit<AppUpdates, "onStatusChanged" | "onBeforeInstall" | "moveToApplications"> & {
		moveToApplications(): Promise<boolean>
		completeBeforeInstall(requestId: string, error: string | null): Promise<void>
	}
	notifications: {
		getPermission(): Promise<NativeNotificationPermissionState>
		requestPermission(): Promise<NativeNotificationPermissionState>
		send(notification: NativeNotificationRequest): Promise<NativeNotificationResult>
		schedule(scope: string, notifications: ScheduledNotificationRequest[]): Promise<void>
		openSystemSettings(): Promise<void>
	}
	font: Font
	keychain: Keychain
	device: Device
	auth: Auth
	account: Account
	subscription: Subscription
	remoteVault: RemoteVault
	members: Members
	shares: Shares
	templateShares: TemplateShares
	devices: Devices
	sync: SyncCommands
	collab: {
		availability(vaultId: string): Promise<CollabAvailability>
		open(channelId: string, vaultId: string, roomPath: string): Promise<void>
		send(channelId: string, op: CollabFrameOp, payload: Uint8Array): Promise<void>
		compact(channelId: string, state: Uint8Array, upTo: number): Promise<void>
		close(channelId: string): Promise<void>
		setFileSyncRole(
			vaultId: string,
			roomPath: string,
			role: CollabFileSyncRole | null,
		): Promise<void>
	}
}

export interface MainEvents {
	"vault-file-changed": WatchEvent & { watcherId: string }
	"deep-link-open": string[]
	"auth-session-expired": undefined
	"app-update-status": AppUpdateStatus
	"app-update-before-install": { requestId: string }
	"sync-state-changed": SyncStateEvent
	"sync-file-event": SyncFileEvent
	"sync-initial-progress": InitialSyncProgressEvent
	"sync-conflict": SyncConflictEvent
	"sync-initial-complete": undefined
	"sync-vek-required": undefined
	"sync-vault-access-denied": SyncAccessDeniedEvent
	"sync-access-changed": EffectiveAccess | null
	"sync-key-trust-issue": KeyTrustIssue
	"sync-log": { level: string; message: string }
	"menu-command": { id: string; payload?: unknown }
	"collab-event": { channelId: string; event: CollabChannelEvent }
	"notification-activation": NotificationActivation
}

export type MainDomain = keyof MainApi

export type MainEventName = keyof MainEvents

export const INVOKE_CHANNEL = "cortex:invoke"

export const EVENT_CHANNEL_PREFIX = "cortex:event:"

export type InvokeResult =
	| { ok: true; value: unknown }
	| { ok: false; message: string; code?: string }
