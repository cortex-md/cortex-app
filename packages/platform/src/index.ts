import type { App } from "./interfaces/App"
import type { Appearance } from "./interfaces/Appearance"
import type { AppUpdates } from "./interfaces/AppUpdates"
import type { Auth } from "./interfaces/Auth"
import type { Capabilities } from "./interfaces/Capabilities"
import type { Device } from "./interfaces/Device"
import type { Devices } from "./interfaces/Devices"
import type { Dialog } from "./interfaces/Dialog"
import type { DocumentExport } from "./interfaces/DocumentExport"
import type { DocumentImport } from "./interfaces/DocumentImport"
import type { FileSystem } from "./interfaces/FileSystem"
import type { Font } from "./interfaces/Font"
import type { Http } from "./interfaces/Http"
import type { Keychain } from "./interfaces/Keychain"
import type { Members } from "./interfaces/Members"
import type { NativeWindow } from "./interfaces/NativeWindow"
import type { Notifications } from "./interfaces/Notifications"
import type { RemoteVault } from "./interfaces/RemoteVault"
import type { Storage } from "./interfaces/Storage"
import type { Subscription } from "./interfaces/Subscription"
import type { Sync } from "./interfaces/Sync"
import type { Vault } from "./interfaces/Vault"

export type { App, DeepLinkOpenListener } from "./interfaces/App"
export type {
	Appearance,
	NativeAppearanceSnapshot,
	NativeColorScheme,
	NativePlatform,
	NativeScrollbarStyle,
} from "./interfaces/Appearance"
export type {
	AppUpdateCheckOptions,
	AppUpdateCheckSource,
	AppUpdateInstallEvent,
	AppUpdateMetadata,
	AppUpdateState,
	AppUpdateStatus,
	AppUpdates,
} from "./interfaces/AppUpdates"
export type { Auth, AuthStatus, CurrentUser, LoginResult, RegisterResult } from "./interfaces/Auth"
export type { Capabilities } from "./interfaces/Capabilities"
export type { Device, DeviceInfo } from "./interfaces/Device"
export type { DeviceEntry, Devices } from "./interfaces/Devices"
export type {
	AlertDialogOptions,
	ConfirmDialogOptions,
	Dialog,
	DialogFilter,
	DialogKind,
	FileDialogOptions,
	FolderDialogOptions,
} from "./interfaces/Dialog"
export type { DocumentExport, ExportHtmlToPdfOptions } from "./interfaces/DocumentExport"
export type {
	DocumentImport,
	PdfTextExtraction,
	PdfTextExtractionOptions,
	PdfTextPage,
} from "./interfaces/DocumentImport"
export type {
	FileEntry,
	FileMetadata,
	FileSnapshot,
	FileSystem,
	WatchEvent,
	WatchOptions,
} from "./interfaces/FileSystem"
export type { Font, FontInfo } from "./interfaces/Font"
export type { Http } from "./interfaces/Http"
export type { Keychain } from "./interfaces/Keychain"
export type { AcceptInviteResult, Members, VaultInvite, VaultMember } from "./interfaces/Members"
export type { NativeWindow } from "./interfaces/NativeWindow"
export type {
	NativeNotificationCapabilities,
	NativeNotificationFailureReason,
	NativeNotificationIcon,
	NativeNotificationKind,
	NativeNotificationPermissionState,
	NativeNotificationRequest,
	NativeNotificationResult,
	NativeNotificationSound,
	NativeNotificationSource,
	NativeNotificationUrgency,
	Notifications,
} from "./interfaces/Notifications"
export type { RemoteVault, RemoteVaultInfo, SyncConfig } from "./interfaces/RemoteVault"
export type { Storage } from "./interfaces/Storage"
export type {
	Subscription,
	SubscriptionBlockCode,
	SubscriptionStatus,
} from "./interfaces/Subscription"
export type {
	ConflictInfo,
	ConflictResolution,
	DeletedFileInfo,
	InitialSyncProgressEvent,
	NoteSyncMetadata,
	Sync,
	SyncAccessDeniedCode,
	SyncAccessDeniedEvent,
	SyncAccessDeniedKind,
	SyncConflictEvent,
	SyncEngineState,
	SyncFileEvent,
	SyncPreferences,
	SyncStateEvent,
	VaultEncryptionStatus,
	VersionInfo,
} from "./interfaces/Sync"
export type { Vault, VaultMetadata, VaultRegistryEntry } from "./interfaces/Vault"

export interface Platform {
	appearance: Appearance
	window: NativeWindow
	fs: FileSystem
	dialog: Dialog
	documentImport?: DocumentImport
	documentExport?: DocumentExport
	storage: Storage
	vault: Vault
	app: App
	appUpdates: AppUpdates
	font: Font
	http: Http
	keychain: Keychain
	device: Device
	auth: Auth
	subscription: Subscription
	sync: Sync
	remoteVault: RemoteVault
	members: Members
	devices: Devices
	notifications: Notifications
	capabilities: Capabilities[]
}

let _platform: Platform | null = null

export function initPlatform(platform: Platform): void {
	_platform = platform
}

export function getPlatform(): Platform {
	if (!_platform) {
		throw new Error("Platform not initialized. Call initPlatform() first.")
	}
	return _platform
}
