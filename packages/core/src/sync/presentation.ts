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

export type SyncIndicatorKind =
	| "denied"
	| "error"
	| "initial-sync"
	| "transfers"
	| "connecting"
	| "syncing"
	| "synced"
	| "offline"

export interface SyncIndicatorStatus {
	kind: SyncIndicatorKind
	label: string
	tone: SyncStatusTone
	busy: boolean
}

export interface SyncIndicatorInput {
	engineState: SyncEngineState
	error: string | null
	planBlocked: boolean
	initialSyncProgress: { total: number; completed: number } | null
	initialSyncComplete: boolean
	activeSyncCount: number
	lastSyncedAt: number | null
}

const SYNC_STATE_INDICATOR_KINDS: Partial<Record<SyncEngineState, SyncIndicatorKind>> = {
	authenticating: "connecting",
	connecting: "connecting",
	syncing: "syncing",
	recovering: "connecting",
	live: "synced",
	offline: "offline",
}

export function resolveSyncIndicatorStatus(input: SyncIndicatorInput): SyncIndicatorStatus | null {
	if (input.engineState === "denied") {
		return {
			kind: "denied",
			label: input.planBlocked ? "Plan Required" : "Access Denied",
			tone: "error",
			busy: false,
		}
	}
	if (input.error && input.engineState !== "live" && input.engineState !== "idle") {
		return { kind: "error", label: "Sync Error", tone: "error", busy: false }
	}
	if (input.initialSyncProgress && !input.initialSyncComplete) {
		const { total, completed } = input.initialSyncProgress
		return {
			kind: "initial-sync",
			label: total > 0 ? `Syncing ${completed}/${total} files...` : "Syncing...",
			tone: "muted",
			busy: true,
		}
	}
	if (input.activeSyncCount > 0) {
		return {
			kind: "transfers",
			label: `Syncing ${input.activeSyncCount} file(s)...`,
			tone: "muted",
			busy: true,
		}
	}
	if (input.engineState === "offline" && input.lastSyncedAt !== null) {
		return {
			kind: "synced",
			label: SYNC_STATUS_PRESENTATION.live.label,
			tone: "success",
			busy: false,
		}
	}
	const kind = SYNC_STATE_INDICATOR_KINDS[input.engineState]
	if (!kind) return null
	const presentation = SYNC_STATUS_PRESENTATION[input.engineState]
	const busy = kind === "connecting" || kind === "syncing"
	return {
		kind,
		label: busy ? `${presentation.label}...` : presentation.label,
		tone: presentation.tone,
		busy,
	}
}
