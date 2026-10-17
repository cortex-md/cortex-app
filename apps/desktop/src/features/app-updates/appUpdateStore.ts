import { flushPendingWrites, getErrorMessage } from "@cortex/core"
import {
	type AppUpdateErrorCode,
	type AppUpdatePreferences,
	type AppUpdateStatus,
	getPlatform,
} from "@cortex/platform"
import { useSyncExternalStore } from "react"

const initialStatus: AppUpdateStatus = {
	state: "idle",
	currentVersion: null,
	pendingUpdate: null,
	lastCheckedAt: null,
	lastError: null,
	installMode: "automatic",
	installOnQuit: true,
	downloaded: 0,
	contentLength: null,
}

let snapshot: AppUpdateStatus = initialStatus
const listeners = new Set<() => void>()
let stopListening: (() => void) | null = null

function emit(nextSnapshot: AppUpdateStatus): AppUpdateStatus {
	snapshot = nextSnapshot
	for (const listener of listeners) listener()
	return snapshot
}

function getErroredStatus(error: unknown, code: AppUpdateErrorCode = "NETWORK"): AppUpdateStatus {
	return {
		...snapshot,
		state: "error",
		lastError: { code, message: getErrorMessage(error) },
	}
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

export function useAppUpdateSnapshot(): AppUpdateStatus {
	return useSyncExternalStore(
		subscribe,
		() => snapshot,
		() => snapshot,
	)
}

/** Re-renders only when the selected primitive changes, not on every progress tick. */
export function useAppUpdateSelector<T extends string | number | boolean | null>(
	select: (status: AppUpdateStatus) => T,
): T {
	return useSyncExternalStore(
		subscribe,
		() => select(snapshot),
		() => select(snapshot),
	)
}

/** Mirrors main-process status and answers its pre-install flush requests. Once per window. */
export function startAppUpdateSync(): () => void {
	if (stopListening) return stopListening
	const updates = getPlatform().appUpdates
	const stopStatus = updates.onStatusChanged((status) => emit(status))
	const stopFlush = updates.onBeforeInstall?.(flushPendingWrites) ?? (() => {})
	stopListening = () => {
		stopStatus()
		stopFlush()
		stopListening = null
	}
	return stopListening
}

export async function refreshAppUpdateStatus(): Promise<AppUpdateStatus> {
	try {
		return emit(await getPlatform().appUpdates.getStatus())
	} catch (error) {
		return emit(getErroredStatus(error))
	}
}

export async function configureAppUpdates(
	preferences: AppUpdatePreferences,
): Promise<AppUpdateStatus> {
	try {
		return emit(await getPlatform().appUpdates.configure(preferences))
	} catch (error) {
		return emit(getErroredStatus(error))
	}
}

export async function checkForAppUpdate(source: "startup" | "manual"): Promise<AppUpdateStatus> {
	try {
		return emit(await getPlatform().appUpdates.checkForUpdate({ source }))
	} catch (error) {
		return emit(getErroredStatus(error))
	}
}

export async function downloadAppUpdate(): Promise<AppUpdateStatus> {
	try {
		return emit(await getPlatform().appUpdates.downloadUpdate())
	} catch (error) {
		return emit(getErroredStatus(error))
	}
}

export async function installAppUpdateNow(): Promise<AppUpdateStatus> {
	try {
		await flushPendingWrites()
		return emit(await getPlatform().appUpdates.installNow())
	} catch (error) {
		return emit(getErroredStatus(error, "INSTALL_FAILED"))
	}
}

export async function setAppUpdateInstallOnQuit(enabled: boolean): Promise<AppUpdateStatus> {
	try {
		return emit(await getPlatform().appUpdates.setInstallOnQuit(enabled))
	} catch (error) {
		return emit(getErroredStatus(error))
	}
}

export async function moveAppToApplications(): Promise<boolean> {
	try {
		return (await getPlatform().appUpdates.moveToApplications?.()) ?? false
	} catch {
		return false
	}
}

export async function fetchAppUpdateChangelog(version: string): Promise<string | null> {
	try {
		return await getPlatform().appUpdates.fetchChangelog(version)
	} catch {
		return null
	}
}

export function getAppUpdateSnapshot(): AppUpdateStatus {
	return snapshot
}
