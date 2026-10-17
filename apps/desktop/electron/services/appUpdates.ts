import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { AppUpdatePreferences, AppUpdateStatus } from "@cortex/platform"
import { app, dialog, type Event } from "electron"
import writeFileAtomic from "write-file-atomic"
import type { MainApi } from "../contract"
import { emitToRenderer } from "../events"
import { getInvokeSender } from "../ipc/sender"
import { registerBeforeInstallHook } from "../shutdownHooks"
import type { Updater } from "../updates/updater"
import { emitToWindow, listMainWindows, onFirstWindowRevealed } from "../windows"
import { flushReminderWrites } from "./reminderScheduler"
import { stopSyncWorkersGracefully } from "./syncBridge"
import { stopAllWatchers } from "./watcher"

const SYNC_SHUTDOWN_TIMEOUT_MS = 4_000
const MOVE_PROMPT_FILE = "update-move-prompt.json"

let updater: Updater | null = null
let updaterPromise: Promise<Updater> | null = null
let preferences: AppUpdatePreferences | null = null
let quitInstallStarted = false
let windowRevealed = false
let stagingCleanedWithoutUpdater = false

function loadUpdater(): Promise<Updater> {
	updaterPromise ??= import("../updates/updater").then(({ Updater }) => {
		const instance = new Updater()
		instance.onStatusChanged((status) => emitToRenderer("app-update-status", status))
		if (preferences) instance.configure(preferences)
		updater = instance
		return instance
	})
	return updaterPromise
}

/** With automatic checks off the updater never loads; only its leftover files are removed. */
async function cleanStagingWithoutUpdater(): Promise<void> {
	const [{ cleanStaging, stagingLayoutFor }, { detectCurrentInstallType, userCacheDir }] =
		await Promise.all([import("../updates/staging"), import("../updates/currentInstall")])
	const layout = stagingLayoutFor(
		detectCurrentInstallType(),
		app.getPath("userData"),
		userCacheDir(),
	)
	const removed = await cleanStaging(layout, null)
	if (removed.length > 0) console.info(`[updates] removed ${removed.length} stale update files`)
}

/** Waits for both the first visible window and the renderer's preferences before doing anything. */
function startWhenWanted(): void {
	if (!windowRevealed || !preferences) return
	if (preferences.autoCheck) {
		void loadUpdater()
			.then((instance) => instance.start())
			.catch((error) => console.error("[updates] failed to load the updater:", error))
		return
	}
	if (updater || stagingCleanedWithoutUpdater) return
	stagingCleanedWithoutUpdater = true
	void cleanStagingWithoutUpdater().catch((error) =>
		console.warn("[updates] failed to clean staging:", error),
	)
}

function idleStatus(): AppUpdateStatus {
	return {
		state: "idle",
		currentVersion: app.getVersion(),
		pendingUpdate: null,
		lastCheckedAt: null,
		lastError: null,
		installMode: app.isPackaged ? "automatic" : "unsupported",
		installOnQuit: true,
		downloaded: 0,
		contentLength: null,
	}
}

interface PendingFlush {
	contentsId: number
	resolve: () => void
	reject: (error: Error) => void
}

const pendingFlushes = new Map<string, PendingFlush>()

/** Asks every window with an open vault to save notes and state files, and waits for each answer. */
async function flushRendererWrites(): Promise<void> {
	const targets = listMainWindows().filter((window) => window.vaultPath !== null)
	const requestIds: string[] = []
	try {
		await Promise.all(
			targets.map(
				({ contentsId }) =>
					new Promise<void>((resolve, reject) => {
						const requestId = randomUUID()
						requestIds.push(requestId)
						pendingFlushes.set(requestId, { contentsId, resolve, reject })
						emitToWindow(contentsId, "app-update-before-install", { requestId })
					}),
			),
		)
	} finally {
		for (const requestId of requestIds) pendingFlushes.delete(requestId)
	}
}

async function completeBeforeInstall(requestId: string, error: string | null): Promise<void> {
	const pending = pendingFlushes.get(requestId)
	if (!pending || pending.contentsId !== getInvokeSender()?.id) return
	pendingFlushes.delete(requestId)
	if (error) pending.reject(new Error(error))
	else pending.resolve()
}

function movePromptPath(): string {
	return join(app.getPath("userData"), MOVE_PROMPT_FILE)
}

async function offerMoveToApplications(): Promise<void> {
	if (process.platform !== "darwin" || !app.isPackaged || app.isInApplicationsFolder()) return
	const dismissed = await readFile(movePromptPath(), "utf8").then(
		() => true,
		() => false,
	)
	if (dismissed) return
	const { response, checkboxChecked } = await dialog.showMessageBox({
		type: "question",
		message: "Move Cortex to the Applications folder?",
		detail: "Cortex can only install updates by itself when it runs from Applications.",
		buttons: ["Move to Applications", "Not Now"],
		defaultId: 0,
		cancelId: 1,
		checkboxLabel: "Don't ask again",
	})
	if (checkboxChecked) {
		await writeFileAtomic(movePromptPath(), JSON.stringify({ dismissedAt: Date.now() }), "utf8")
	}
	if (response === 0) moveToApplications()
}

function moveToApplications(): boolean {
	try {
		return app.moveToApplicationsFolder({
			conflictHandler: (conflictType) => conflictType === "exists",
		})
	} catch (error) {
		console.warn("[updates] could not move to Applications:", error)
		return false
	}
}

export function setupAppUpdates(): void {
	registerBeforeInstallHook("renderer-writes", "flush", flushRendererWrites)
	registerBeforeInstallHook("reminder-writes", "flush", flushReminderWrites)
	registerBeforeInstallHook("file-watchers", "teardown", stopAllWatchers)
	registerBeforeInstallHook("sync-workers", "teardown", () =>
		stopSyncWorkersGracefully(SYNC_SHUTDOWN_TIMEOUT_MS),
	)
	onFirstWindowRevealed(() => {
		windowRevealed = true
		startWhenWanted()
		void offerMoveToApplications().catch((error) =>
			console.warn("[updates] move to Applications prompt failed:", error),
		)
	})
}

/** Returns true when the quit was deferred to install a ready update first. */
export function deferQuitForUpdate(event: Event): boolean {
	if (quitInstallStarted || !updater?.shouldInstallOnQuit()) return false
	quitInstallStarted = true
	event.preventDefault()
	const instance = updater
	void instance
		.installOnQuit()
		.catch((error) => console.error("[updates] install on quit failed:", error))
		.finally(() => app.quit())
	return true
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
	getStatus: async () => updater?.getStatus() ?? idleStatus(),
	configure: async (next) => {
		preferences = {
			autoCheck: next.autoCheck === true,
			channel: next.channel === "beta" ? "beta" : "stable",
		}
		const status = updater?.configure(preferences) ?? idleStatus()
		startWhenWanted()
		return status
	},
	checkForUpdate: async ({ source }) =>
		await (await loadUpdater()).check(source === "manual" ? "manual" : "startup"),
	downloadUpdate: async () => await (await loadUpdater()).download(),
	installNow: async () => await (await loadUpdater()).installNow(),
	setInstallOnQuit: async (enabled) => (await loadUpdater()).setInstallOnQuit(enabled === true),
	moveToApplications: async () => moveToApplications(),
	completeBeforeInstall,
	fetchChangelog,
} satisfies MainApi["appUpdates"]
