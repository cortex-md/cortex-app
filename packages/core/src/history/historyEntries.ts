import type { VersionInfo } from "@cortex/platform"
import { getBaseName } from "@cortex/platform/utils"
import { parseTimestamp } from "./historyTime"
import { HISTORY_CONTENT_HASH_LENGTH, type LocalVersion } from "./localHistory"

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

function entryContentHash(entry: HistoryEntry): string | null {
	if (entry.kind === "local") return entry.local.hash
	if (entry.kind === "server")
		return entry.server.checksum?.slice(0, HISTORY_CONTENT_HASH_LENGTH) ?? null
	return null
}

function preferEntry(current: HistoryEntry, candidate: HistoryEntry): HistoryEntry {
	return current.kind !== "server" && candidate.kind === "server" ? candidate : current
}

export function buildEntries(
	localVersions: readonly LocalVersion[],
	serverVersions: readonly VersionInfo[],
	currentHash: string | null = null,
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
	].sort(compareEntries)

	const changes: { hash: string | null; entry: HistoryEntry }[] = []
	for (const entry of versions.reverse()) {
		const hash = entryContentHash(entry)
		const previous = changes.at(-1)
		if (previous && hash !== null && previous.hash === hash) {
			previous.entry = preferEntry(previous.entry, entry)
			continue
		}
		changes.push({ hash, entry })
	}
	const current = currentHash?.slice(0, HISTORY_CONTENT_HASH_LENGTH) ?? null
	if (current !== null && changes.at(-1)?.hash === current) changes.pop()
	return [CURRENT_ENTRY, ...changes.reverse().map((change) => change.entry)]
}

export function copyName(filePath: string, entry: HistoryEntry): string {
	const baseName = getBaseName(filePath).replace(/\.md$/i, "")
	return entry.kind === "server"
		? `${baseName} (version ${entry.server.version})`
		: `${baseName} (earlier version)`
}
