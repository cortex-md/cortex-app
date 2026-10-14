import { resolveSyncIndicatorStatus, useSyncStore, useVaultStore } from "@cortex/core"
import { getBaseName, joinPath } from "@cortex/platform/utils"
import { useMemo } from "react"

import type { SymbolName } from "@/components/ui/Symbol"
import type { MobileColors } from "@/theme/colors"

const SYNCED_ICON: SymbolName = { sf: "checkmark.icloud", md: "cloud_done" }

export interface SyncStatusPresentation {
	icon: SymbolName
	label: string
	busy: boolean
	color: (colors: MobileColors) => string
}

export interface SyncConflictItem {
	relativePath: string
	filePath: string
	name: string
}

export function useSyncStatusPresentation(): SyncStatusPresentation {
	const engineState = useSyncStore((state) => state.engineState)
	const error = useSyncStore((state) => state.error)
	const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
	const syncingFiles = useSyncStore((state) => state.syncingFiles)
	const initialSyncProgress = useSyncStore((state) => state.initialSyncProgress)
	const initialSyncComplete = useSyncStore((state) => state.initialSyncComplete)
	const indicator = resolveSyncIndicatorStatus({
		engineState,
		error,
		planBlocked: false,
		initialSyncProgress,
		initialSyncComplete,
		activeSyncCount: Object.keys(syncingFiles).length,
		lastSyncedAt,
	})
	if (!indicator || indicator.kind === "synced") {
		return {
			busy: false,
			color: (colors) => colors.successText,
			icon: SYNCED_ICON,
			label: "Synced",
		}
	}
	switch (indicator.kind) {
		case "offline":
			return {
				busy: false,
				color: (colors) => colors.warningText,
				icon: { sf: "icloud.slash", md: "cloud_off" },
				label: "Offline",
			}
		case "error":
		case "denied":
			return {
				busy: false,
				color: (colors) => colors.destructiveText,
				icon: { sf: "exclamationmark.icloud", md: "sync_problem" },
				label: indicator.label,
			}
		default:
			return {
				busy: Boolean(indicator.busy),
				color: (colors) => colors.secondaryLabel,
				icon: { sf: "arrow.triangle.2.circlepath.icloud", md: "sync" },
				label: indicator.busy ? "Syncing…" : indicator.label,
			}
	}
}

export function useSyncConflicts(): SyncConflictItem[] {
	const conflicts = useSyncStore((state) => state.conflicts)
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	return useMemo(() => {
		if (!vaultPath) return []
		return Object.keys(conflicts)
			.sort((left, right) => left.localeCompare(right))
			.map((relativePath) => ({
				filePath: joinPath(vaultPath, relativePath),
				name: getBaseName(relativePath).replace(/\.md$/iu, ""),
				relativePath,
			}))
	}, [conflicts, vaultPath])
}

export function useSyncConflictCount(): number {
	return useSyncStore((state) => Object.keys(state.conflicts).length)
}
