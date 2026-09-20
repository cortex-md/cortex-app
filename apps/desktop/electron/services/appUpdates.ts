import { app } from "electron"
import { autoUpdater } from "electron-updater"
import { emitToRenderer } from "../events"

export interface AppUpdateStatus {
	state: string
	currentVersion: string | null
	pendingUpdate: {
		version: string
		currentVersion: string
		body: string | null
		date: string | null
		target: string | null
	} | null
	lastCheckedAt: string | null
	lastError: string | null
	downloaded: number
	contentLength: number | null
}

let lastStatus: AppUpdateStatus = {
	state: "idle",
	currentVersion: null,
	pendingUpdate: null,
	lastCheckedAt: null,
	lastError: null,
	downloaded: 0,
	contentLength: null,
}

function currentVersion(): string {
	return app.getVersion()
}

export function getStatus(): AppUpdateStatus {
	return {
		...lastStatus,
		currentVersion: currentVersion(),
	}
}

export async function checkForUpdate(_source: string): Promise<AppUpdateStatus> {
	try {
		lastStatus = {
			...lastStatus,
			state: "checking",
			currentVersion: currentVersion(),
			lastError: null,
		}
		const result = await autoUpdater.checkForUpdates()
		const update = result?.updateInfo
		if (!update || update.version === currentVersion()) {
			lastStatus = {
				...lastStatus,
				state: "up-to-date",
				pendingUpdate: null,
				lastCheckedAt: new Date().toISOString(),
			}
		} else {
			lastStatus = {
				...lastStatus,
				state: "available",
				pendingUpdate: {
					version: update.version,
					currentVersion: currentVersion(),
					body: typeof update.releaseNotes === "string" ? update.releaseNotes : null,
					date: update.releaseDate ?? null,
					target: process.platform,
				},
				lastCheckedAt: new Date().toISOString(),
			}
		}
	} catch (error) {
		lastStatus = {
			...lastStatus,
			state: app.isPackaged ? "error" : "unsupported",
			lastError: error instanceof Error ? error.message : String(error),
			lastCheckedAt: new Date().toISOString(),
		}
	}
	return getStatus()
}

export async function installUpdate(): Promise<AppUpdateStatus> {
	try {
		lastStatus = { ...lastStatus, state: "installing", lastError: null }
		autoUpdater.on("download-progress", (progress) => {
			lastStatus = {
				...lastStatus,
				downloaded: progress.transferred,
				contentLength: progress.total,
			}
			emitToRenderer("app-update-install", {
				event: "progress",
				data: {
					chunkLength: progress.delta,
					downloaded: progress.transferred,
					contentLength: progress.total,
				},
			})
		})
		await autoUpdater.downloadUpdate()
		lastStatus = { ...lastStatus, state: "installed" }
		autoUpdater.quitAndInstall()
	} catch (error) {
		lastStatus = {
			...lastStatus,
			state: "error",
			lastError: error instanceof Error ? error.message : String(error),
		}
	}
	return getStatus()
}

export async function fetchChangelog(version: string): Promise<string | null> {
	const response = await fetch(
		`https://api.github.com/repos/cortex-md/cortex-app/releases/tags/v${version}`,
		{
			headers: {
				Accept: "application/vnd.github+json",
				"User-Agent": "Cortex desktop updater",
			},
		},
	)
	if (!response.ok) return null
	const body = (await response.json()) as { body?: string | null }
	return body.body ?? null
}
