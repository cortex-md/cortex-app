import type { CurrentUser, DeviceEntry, MemberDevice, VaultMember } from "@cortex/platform"
import { countWordChanges, type WordChangeCount } from "../utils/textDiff"

export interface SyncActorNames {
	personName: (userId: string | null) => string | null
	deviceName: (deviceId: string | null) => string | null
	currentDeviceId: string | null
}

export function buildSyncActorNames(
	user: CurrentUser | null,
	members: readonly VaultMember[],
	memberDevices: readonly MemberDevice[],
	deviceEntries: readonly DeviceEntry[],
): SyncActorNames {
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
}

export const VERSION_PREFETCH_LIMIT = 30
export const VERSION_PREFETCH_CONCURRENCY = 2

export function computeVersionDeltas<T extends { id: string }>(
	entries: readonly T[] | null,
	contents: Readonly<Record<string, string>>,
	deltaCache: Map<string, WordChangeCount>,
): Record<string, WordChangeCount> {
	const result: Record<string, WordChangeCount> = {}
	if (!entries) return result
	for (const [index, entry] of entries.slice(0, VERSION_PREFETCH_LIMIT).entries()) {
		const previous = entries[index + 1]
		const after = contents[entry.id]
		const before = previous ? contents[previous.id] : ""
		if (after === undefined || before === undefined) continue
		const key = `${entry.id}:${previous?.id ?? "start"}`
		let delta = deltaCache.get(key)
		if (!delta) {
			delta = countWordChanges(before, after)
			deltaCache.set(key, delta)
		}
		result[entry.id] = delta
	}
	return result
}
