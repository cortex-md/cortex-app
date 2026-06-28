import { noteCache, useEditorStore } from "@cortex/core"
import { type AppUpdateInstallEvent, type AppUpdateStatus, getPlatform } from "@cortex/platform"
import { useSyncExternalStore } from "react"

const initialStatus: AppUpdateStatus = {
	state: "idle",
	currentVersion: null,
	pendingUpdate: null,
	lastCheckedAt: null,
	lastError: null,
	downloaded: 0,
	contentLength: null,
}

let snapshot: AppUpdateStatus = initialStatus
const listeners = new Set<() => void>()

function emit(nextSnapshot: AppUpdateStatus): AppUpdateStatus {
	snapshot = nextSnapshot
	for (const listener of listeners) listener()
	return snapshot
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function getErroredStatus(error: unknown): AppUpdateStatus {
	return {
		...snapshot,
		state: "error",
		lastError: getErrorMessage(error),
	}
}

function applyInstallEvent(event: AppUpdateInstallEvent): void {
	if (event.event === "started") {
		emit({
			...snapshot,
			state: "installing",
			downloaded: 0,
			contentLength: event.data.contentLength,
			lastError: null,
		})
		return
	}

	if (event.event === "progress") {
		emit({
			...snapshot,
			state: "installing",
			downloaded: event.data.downloaded,
			contentLength: event.data.contentLength,
			lastError: null,
		})
		return
	}

	emit({
		...snapshot,
		state: "installing",
		lastError: null,
	})
}

async function flushOpenNotesBeforeInstall(): Promise<void> {
	await Promise.all([noteCache.flushAll(), useEditorStore.getState().flushActive()])
}

export function useAppUpdateSnapshot(): AppUpdateStatus {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		() => snapshot,
		() => snapshot,
	)
}

export async function refreshAppUpdateStatus(): Promise<AppUpdateStatus> {
	try {
		return emit(await getPlatform().appUpdates.getStatus())
	} catch (error) {
		return emit(getErroredStatus(error))
	}
}

export async function checkForAppUpdate(source: "startup" | "manual"): Promise<AppUpdateStatus> {
	emit({
		...snapshot,
		state: "checking",
		lastError: null,
	})
	try {
		return emit(await getPlatform().appUpdates.checkForUpdate({ source }))
	} catch (error) {
		return emit(getErroredStatus(error))
	}
}

export async function installPendingAppUpdate(): Promise<AppUpdateStatus> {
	emit({
		...snapshot,
		state: "installing",
		downloaded: 0,
		contentLength: snapshot.pendingUpdate ? snapshot.contentLength : null,
		lastError: null,
	})
	try {
		await flushOpenNotesBeforeInstall()
		return emit(await getPlatform().appUpdates.installUpdate(applyInstallEvent))
	} catch (error) {
		return emit(getErroredStatus(error))
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
