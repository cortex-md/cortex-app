export type AppUpdateCheckSource = "startup" | "manual"

export type AppUpdateState =
	| "idle"
	| "checking"
	| "up-to-date"
	| "available"
	| "installing"
	| "installed"
	| "error"
	| "unsupported"

export interface AppUpdateCheckOptions {
	source: AppUpdateCheckSource
}

export interface AppUpdateMetadata {
	version: string
	currentVersion: string
	body: string | null
	date: string | null
	target: string | null
}

export interface AppUpdateStatus {
	state: AppUpdateState
	currentVersion: string | null
	pendingUpdate: AppUpdateMetadata | null
	lastCheckedAt: string | null
	lastError: string | null
	downloaded: number
	contentLength: number | null
}

export type AppUpdateInstallEvent =
	| {
			event: "started"
			data: {
				contentLength: number | null
			}
	  }
	| {
			event: "progress"
			data: {
				chunkLength: number
				downloaded: number
				contentLength: number | null
			}
	  }
	| {
			event: "finished"
	  }

export interface AppUpdates {
	getStatus(): Promise<AppUpdateStatus>
	checkForUpdate(options: AppUpdateCheckOptions): Promise<AppUpdateStatus>
	installUpdate(onEvent?: (event: AppUpdateInstallEvent) => void): Promise<AppUpdateStatus>
	fetchChangelog(version: string): Promise<string | null>
}
