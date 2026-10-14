import type { SyncActorNames } from "@cortex/core"
import {
	buildSyncActorNames,
	useAuthStore,
	useDevicesStore,
	useMembersStore,
	useRemoteVaultStore,
} from "@cortex/core"
import { useEffect, useMemo } from "react"

export type { SyncActorNames }

export function useSyncActorNames(): SyncActorNames {
	const user = useAuthStore((state) => state.user)
	const members = useMembersStore((state) => state.members)
	const memberDevices = useMembersStore((state) => state.memberDevices)
	const deviceEntries = useDevicesStore((state) => state.deviceEntries)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const authenticated = useAuthStore((state) => state.authenticated)

	useEffect(() => {
		if (!authenticated) return
		if (useDevicesStore.getState().deviceEntries.length === 0) {
			void useDevicesStore.getState().fetchDevices()
		}
		if (linkedVaultId && useMembersStore.getState().overviewVaultId !== linkedVaultId) {
			void useMembersStore.getState().fetchOverview(linkedVaultId)
		}
	}, [authenticated, linkedVaultId])

	return useMemo(
		() => buildSyncActorNames(user, members, memberDevices, deviceEntries),
		[user, members, memberDevices, deviceEntries],
	)
}
