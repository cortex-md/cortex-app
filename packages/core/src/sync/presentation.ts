import type { SyncEngineState } from "@cortex/platform"

export type SyncStatusTone = "muted" | "success" | "warning" | "error"

export interface SyncStatusPresentation {
	label: string
	tone: SyncStatusTone
}

export const SYNC_STATUS_PRESENTATION: Record<SyncEngineState, SyncStatusPresentation> = {
	idle: { label: "Idle", tone: "muted" },
	authenticating: { label: "Authenticating", tone: "muted" },
	connecting: { label: "Connecting", tone: "muted" },
	syncing: { label: "Syncing", tone: "muted" },
	live: { label: "Synced", tone: "success" },
	offline: { label: "Offline", tone: "warning" },
	recovering: { label: "Recovering", tone: "muted" },
	denied: { label: "Access denied", tone: "error" },
}

export function formatLastSyncedAt(
	lastSyncedAt: number | null,
	now: () => number = Date.now,
): string {
	if (!lastSyncedAt) return "Not synced yet"
	const elapsedMinutes = Math.floor((now() - lastSyncedAt) / 60000)
	if (elapsedMinutes <= 0) return "Just now"
	if (elapsedMinutes < 60) {
		return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`
	}
	const elapsedHours = Math.floor(elapsedMinutes / 60)
	if (elapsedHours < 24) {
		return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`
	}
	return new Date(lastSyncedAt).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	})
}
