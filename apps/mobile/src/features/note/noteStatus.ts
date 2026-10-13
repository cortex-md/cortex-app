import { resolveSyncIndicatorStatus, type SyncStatusTone, useSyncStore } from "@cortex/core"
import { CloudCheck, CloudOff, type LucideIcon, RefreshCw, TriangleAlert } from "lucide-react-native"

import type { MobileColors } from "@/theme/colors"

export interface NoteStatusPresentation {
	Icon: LucideIcon
	label: string
	tone: SyncStatusTone
}

export function statusToneColor(tone: SyncStatusTone, colors: MobileColors): string {
	switch (tone) {
		case "success":
			return colors.successText
		case "warning":
			return colors.warningText
		case "error":
			return colors.destructiveText
		default:
			return colors.secondaryLabel
	}
}

export function useNoteStatus(editing: boolean): NoteStatusPresentation {
	const engineState = useSyncStore((state) => state.engineState)
	const error = useSyncStore((state) => state.error)
	const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
	const syncingFiles = useSyncStore((state) => state.syncingFiles)
	const initialSyncProgress = useSyncStore((state) => state.initialSyncProgress)
	const initialSyncComplete = useSyncStore((state) => state.initialSyncComplete)
	if (editing) return { Icon: RefreshCw, label: "Syncing…", tone: "muted" }
	const indicator = resolveSyncIndicatorStatus({
		engineState,
		error,
		planBlocked: false,
		initialSyncProgress,
		initialSyncComplete,
		activeSyncCount: Object.keys(syncingFiles).length,
		lastSyncedAt,
	})
	if (!indicator) return { Icon: CloudCheck, label: "Synced", tone: "success" }
	switch (indicator.kind) {
		case "offline":
			return { Icon: CloudOff, label: "Offline", tone: "warning" }
		case "error":
		case "denied":
			return { Icon: TriangleAlert, label: indicator.label, tone: "error" }
		case "synced":
			return { Icon: CloudCheck, label: "Synced", tone: "success" }
		default:
			return { Icon: RefreshCw, label: indicator.busy ? "Syncing…" : indicator.label, tone: "muted" }
	}
}
