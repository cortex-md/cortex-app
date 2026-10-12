import { useAuthStore, useDevicesStore, useMembersStore, useRemoteVaultStore } from "@cortex/core"
import { useEffect, useMemo } from "react"

export interface SyncActorNames {
	personName: (userId: string | null) => string | null
	deviceName: (deviceId: string | null) => string | null
	currentDeviceId: string | null
}

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

	return useMemo(() => {
		const people = new Map<string, string>()
		for (const member of members) people.set(member.userId, member.displayName || member.email)
		if (user) people.set(user.userId, user.displayName || user.email)
		const devices = new Map<string, string>()
		for (const device of memberDevices) devices.set(device.id, device.deviceName)
		for (const device of deviceEntries) devices.set(device.id, device.deviceName)
		return {
			personName: (userId) => (userId ? (people.get(userId) ?? null) : null),
			deviceName: (deviceId) => (deviceId ? (devices.get(deviceId) ?? null) : null),
			currentDeviceId: deviceEntries.find((device) => device.isCurrent)?.id ?? null,
		}
	}, [user, members, memberDevices, deviceEntries])
}
