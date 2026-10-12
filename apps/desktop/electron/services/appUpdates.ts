import type { AppUpdateStatus } from "@cortex/platform"
import { app } from "electron"
import electronUpdater from "electron-updater"
import type { MainApi } from "../contract"
import { emitToRenderer } from "../events"

const { autoUpdater } = electronUpdater

autoUpdater.autoDownload = false

let status: AppUpdateStatus = {
	state: "idle",
	currentVersion: null,
	pendingUpdate: null,
	lastCheckedAt: null,
	lastError: null,
	downloaded: 0,
	contentLength: null,
}

autoUpdater.on("download-progress", (progress) => {
	status = { ...status, downloaded: progress.transferred, contentLength: progress.total }
	emitToRenderer("app-update-install", {
		event: "progress",
		data: {
			chunkLength: progress.delta,
			downloaded: progress.transferred,
			contentLength: progress.total,
		},
	})
})

function getStatus(): AppUpdateStatus {
	return { ...status, currentVersion: app.getVersion() }
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

async function checkForUpdate(): Promise<AppUpdateStatus> {
	status = { ...status, state: "checking", lastError: null }
	try {
		const result = await autoUpdater.checkForUpdates()
		const update = result?.isUpdateAvailable ? result.updateInfo : null
		status = {
			...status,
			state: update ? "available" : "up-to-date",
			pendingUpdate: update && {
				version: update.version,
				currentVersion: app.getVersion(),
				body: typeof update.releaseNotes === "string" ? update.releaseNotes : null,
				date: update.releaseDate ?? null,
				target: process.platform,
			},
			lastCheckedAt: new Date().toISOString(),
		}
	} catch (error) {
		status = {
			...status,
			state: app.isPackaged ? "error" : "unsupported",
			lastError: errorMessage(error),
			lastCheckedAt: new Date().toISOString(),
		}
	}
	return getStatus()
}

async function installUpdate(): Promise<AppUpdateStatus> {
	status = { ...status, state: "installing", lastError: null }
	try {
		emitToRenderer("app-update-install", { event: "started", data: { contentLength: null } })
		await autoUpdater.downloadUpdate()
		emitToRenderer("app-update-install", { event: "finished" })
		status = { ...status, state: "installed" }
		setImmediate(() => autoUpdater.quitAndInstall())
	} catch (error) {
		status = { ...status, state: "error", lastError: errorMessage(error) }
	}
	return getStatus()
}

async function fetchChangelog(version: string): Promise<string | null> {
	const response = await fetch(
		`https://api.github.com/repos/cortex-md/cortex-app/releases/tags/v${encodeURIComponent(version)}`,
		{
			headers: {
				Accept: "application/vnd.github+json",
				"User-Agent": "Cortex desktop updater",
			},
		},
	)
	if (!response.ok) return null
	return ((await response.json()) as { body?: string | null }).body ?? null
}

export const appUpdatesApi = {
	getStatus: async () => getStatus(),
	checkForUpdate: async () => await checkForUpdate(),
	installUpdate,
	fetchChangelog,
} satisfies MainApi["appUpdates"]
