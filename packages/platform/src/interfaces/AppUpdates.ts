export type AppUpdateCheckSource = "startup" | "scheduled" | "manual"

export type AppUpdateChannel = "stable" | "beta"

export type AppUpdateState =
	| "idle"
	| "checking"
	| "up-to-date"
	| "available"
	| "downloading"
	| "verifying"
	| "ready"
	| "installing"
	| "error"
	| "unsupported"

export type AppUpdateErrorCode =
	| "NETWORK"
	| "MANIFEST_INVALID"
	| "SIGNATURE_INVALID"
	| "HASH_MISMATCH"
	| "NO_PLATFORM_BUILD"
	| "NOT_IN_APPLICATIONS"
	| "NO_WRITE_PERMISSION"
	| "UNSUPPORTED_INSTALL_TYPE"
	| "INSTALL_FAILED"

/**
 * `automatic` replaces the app in place, `manual` opens the downloaded package or the release page
 * for the user to finish, `unsupported` means this build cannot update (development builds).
 */
export type AppUpdateInstallMode = "automatic" | "manual" | "unsupported"

export interface AppUpdateCheckOptions {
	source: AppUpdateCheckSource
}

export interface AppUpdatePreferences {
	autoCheck: boolean
	channel: AppUpdateChannel
}

export interface AppUpdateMetadata {
	version: string
	currentVersion: string
	body: string | null
	date: string | null
	target: string | null
	downloadUrl: string | null
}

export interface AppUpdateError {
	code: AppUpdateErrorCode
	message: string
}

export interface AppUpdateStatus {
	state: AppUpdateState
	currentVersion: string | null
	pendingUpdate: AppUpdateMetadata | null
	lastCheckedAt: string | null
	lastError: AppUpdateError | null
	installMode: AppUpdateInstallMode
	installOnQuit: boolean
	downloaded: number
	contentLength: number | null
}

export interface AppUpdates {
	getStatus(): Promise<AppUpdateStatus>
	configure(preferences: AppUpdatePreferences): Promise<AppUpdateStatus>
	checkForUpdate(options: AppUpdateCheckOptions): Promise<AppUpdateStatus>
	downloadUpdate(): Promise<AppUpdateStatus>
	installNow(): Promise<AppUpdateStatus>
	setInstallOnQuit(enabled: boolean): Promise<AppUpdateStatus>
	moveToApplications?(): Promise<boolean>
	fetchChangelog(version: string): Promise<string | null>
	onStatusChanged(listener: (status: AppUpdateStatus) => void): () => void
	/**
	 * Registers the work that must finish before the app quits to install (pending note and state
	 * writes). A rejection cancels the install so unsaved edits are never lost.
	 */
	onBeforeInstall?(handler: () => Promise<void>): () => void
}
