import { startNativeNotifications, useSyncStore, useVaultStore } from "@cortex/core"
import { joinPath } from "@cortex/platform/utils"

import { openConflict } from "@/features/navigation/routes"
import { reloadSyncConflicts } from "@/features/sync/syncConflicts"
import { subscribeNotificationOpen } from "@/platform/notifications"

const CONFLICT_PREFIX = "sync-conflict:"

function openConflictNotification(identifier: string): void {
	if (!identifier.startsWith(CONFLICT_PREFIX)) return
	const vaultPath = useVaultStore.getState().vault?.path
	if (!vaultPath) return
	openConflict(joinPath(vaultPath, identifier.slice(CONFLICT_PREFIX.length)))
}

export function startSyncAlerts(): () => void {
	const stopNotifications = startNativeNotifications()
	const stopOpen = subscribeNotificationOpen(openConflictNotification)
	const stopReload = useSyncStore.subscribe((state, previousState) => {
		if (state.engineState === "live" && previousState.engineState !== "live") {
			void reloadSyncConflicts()
		}
	})
	return () => {
		stopReload()
		stopOpen()
		stopNotifications()
	}
}
