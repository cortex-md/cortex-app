import type { VersionInfo } from "@cortex/platform"
import { getBaseName } from "@cortex/platform/utils"
import { parseTimestamp } from "./historyTime"
import type { LocalVersion } from "./localHistory"

export type DeviceFilter = "all" | "device" | "others"

export type HistoryEntry =
	| { kind: "current"; id: string; timestamp: null }
	| { kind: "local"; id: string; timestamp: number; local: LocalVersion }
	| { kind: "server"; id: string; timestamp: number | null; server: VersionInfo }

export const CURRENT_ENTRY: HistoryEntry = { kind: "current", id: "current", timestamp: null }

export function compareEntries(left: HistoryEntry, right: HistoryEntry): number {
	const timeOrder = (right.timestamp ?? 0) - (left.timestamp ?? 0)
	if (timeOrder !== 0) return timeOrder
	if (left.kind === "server" && right.kind === "server") {
		return right.server.version - left.server.version
	}
	return 0
}

export function buildEntries(
	localVersions: readonly LocalVersion[],
	serverVersions: readonly VersionInfo[],
): HistoryEntry[] {
	const versions: HistoryEntry[] = [
		...localVersions.map(
			(local): HistoryEntry => ({
				kind: "local",
				id: `local:${local.id}`,
				timestamp: local.timestamp,
				local,
			}),
		),
		...serverVersions.map(
			(server): HistoryEntry => ({
				kind: "server",
				id: `server:${server.snapshotId}`,
				timestamp: parseTimestamp(server.createdAt),
				server,
			}),
		),
	]
	return [CURRENT_ENTRY, ...versions.sort(compareEntries)]
}

export function matchesDeviceFilter(
	entry: HistoryEntry,
	filter: DeviceFilter,
	currentDeviceId: string | null,
): boolean {
	if (filter === "all") return true
	const onThisDevice = entry.kind !== "server" || entry.server.deviceId === currentDeviceId
	return filter === "device" ? onThisDevice : !onThisDevice
}

export function copyName(filePath: string, entry: HistoryEntry): string {
	const baseName = getBaseName(filePath).replace(/\.md$/i, "")
	return entry.kind === "server"
		? `${baseName} (version ${entry.server.version})`
		: `${baseName} (earlier version)`
}
