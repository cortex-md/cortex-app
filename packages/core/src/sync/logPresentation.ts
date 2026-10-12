import type { SyncLogEntry, SyncLogLevel } from "../stores/syncLogStore"

export type SyncLogKind =
	| "upload"
	| "download"
	| "merge"
	| "delete"
	| "conflict"
	| "retry"
	| "connection"
	| "event"

export type SyncLogTone = "ok" | "neutral" | "warn" | "error"

export interface SyncLogPresentation {
	kind: SyncLogKind
	tone: SyncLogTone
	title: string
	paths: string[]
	detail?: string
}

export interface SyncLogItem extends SyncLogPresentation {
	id: number
	level: SyncLogLevel
	timestamp: number
	entries: SyncLogEntry[]
}

export interface SyncLogGroup {
	label: string
	items: SyncLogItem[]
}

const AGGREGATE_WINDOW_MS = 15_000
const JUST_NOW_MS = 5 * 60_000

const TRANSFER_PATTERNS: readonly {
	pattern: RegExp
	kind: SyncLogKind
	tone: SyncLogTone
	verb: string
}[] = [
	{ pattern: /^Pushed: (.+)$/, kind: "upload", tone: "ok", verb: "Uploaded" },
	{ pattern: /^Pulled: (.+)$/, kind: "download", tone: "neutral", verb: "Downloaded" },
	{ pattern: /^Merged: (.+)$/, kind: "merge", tone: "ok", verb: "Merged" },
	{ pattern: /^Deleted: (.+)$/, kind: "delete", tone: "neutral", verb: "Deleted" },
]

const CONNECTION_STATES: Record<string, { title: string; tone: SyncLogTone; kind: SyncLogKind }> = {
	live: { title: "Connected", tone: "ok", kind: "connection" },
	connecting: { title: "Connecting", tone: "neutral", kind: "connection" },
	authenticating: { title: "Authenticating", tone: "neutral", kind: "connection" },
	syncing: { title: "Syncing changes", tone: "neutral", kind: "connection" },
	recovering: { title: "Reconnecting", tone: "warn", kind: "retry" },
	offline: { title: "Offline", tone: "warn", kind: "connection" },
	denied: { title: "Access denied", tone: "error", kind: "connection" },
	idle: { title: "Sync stopped", tone: "neutral", kind: "connection" },
}

const LEVEL_TONES: Record<SyncLogLevel, SyncLogTone> = {
	info: "neutral",
	warn: "warn",
	error: "error",
}

function noteName(path: string): string {
	return (path.split("/").at(-1) ?? path).replace(/\.md$/i, "")
}

export function describeSyncLogEntry(entry: SyncLogEntry): SyncLogPresentation {
	const message = entry.message.trim()
	for (const transfer of TRANSFER_PATTERNS) {
		const match = transfer.pattern.exec(message)
		if (match?.[1]) {
			return { kind: transfer.kind, tone: transfer.tone, title: transfer.verb, paths: [match[1]] }
		}
	}

	let match = /^Conflict detected: (.+)$/.exec(message)
	if (match?.[1]) {
		return {
			kind: "conflict",
			tone: "error",
			title: `Conflict in ${noteName(match[1])}`,
			paths: [match[1]],
			detail: "Local and remote both changed since the last common version.",
		}
	}
	match = /^Merge conflict on (.+): kept live version$/.exec(message)
	if (match?.[1]) {
		return {
			kind: "conflict",
			tone: "warn",
			title: `Merged live edits in ${noteName(match[1])}`,
			paths: [match[1]],
			detail: "Both versions changed; the live version was kept.",
		}
	}
	match = /^Sync failed: (.+?) — (.+)$/.exec(message)
	if (match?.[1] && match[2]) {
		return {
			kind: "event",
			tone: "error",
			title: `Couldn't sync ${noteName(match[1])}`,
			paths: [match[1]],
			detail: match[2],
		}
	}
	match = /^Sync state: (\w+)$/.exec(message)
	if (match?.[1]) {
		const state = CONNECTION_STATES[match[1]]
		if (state) return { ...state, paths: [] }
	}
	match = /^(.+) skipped: no access on the server$/.exec(message)
	if (match?.[1]) {
		return { kind: "event", tone: "warn", title: "Skipped without access", paths: [match[1]] }
	}
	match = /^Discarded local changes to read-only (.+)$/.exec(message)
	if (match?.[1]) {
		return {
			kind: "event",
			tone: "warn",
			title: "Discarded read-only changes",
			paths: [match[1]],
		}
	}
	if (/^Initial sync completed/.test(message)) {
		return { kind: "connection", tone: "ok", title: "Initial sync complete", paths: [] }
	}
	if (/^Initial sync starting/.test(message)) {
		return { kind: "connection", tone: "neutral", title: "Initial sync started", paths: [] }
	}

	const metadataPath = entry.metadata?.path
	const errorSplit = /^(.+?):\s(.+)$/.exec(message)
	if (entry.level === "error" && errorSplit?.[1] && errorSplit[2]) {
		return {
			kind: "event",
			tone: "error",
			title: errorSplit[1],
			paths: metadataPath ? [metadataPath] : [],
			detail: errorSplit[2],
		}
	}
	return {
		kind: /retry|retrying/i.test(message) ? "retry" : "event",
		tone: LEVEL_TONES[entry.level],
		title: message,
		paths: metadataPath ? [metadataPath] : [],
	}
}

function pluralizeNotes(count: number): string {
	return `${count} ${count === 1 ? "note" : "notes"}`
}

function aggregateTitle(item: SyncLogItem): string {
	if (!isAggregatable(item.kind) || item.paths.length === 0) return item.title
	if (item.paths.length === 1) return `${item.title} ${noteName(item.paths[0] ?? "")}`
	return `${item.title} ${pluralizeNotes(item.paths.length)}`
}

export function formatSyncLogPaths(paths: readonly string[], limit = 2): string {
	if (paths.length <= limit) return paths.join(", ")
	return `${paths.slice(0, limit).join(", ")} and ${paths.length - limit} more`
}

function isAggregatable(kind: SyncLogKind): boolean {
	return kind === "upload" || kind === "download" || kind === "merge" || kind === "delete"
}

function startOfDay(timestamp: number): number {
	const date = new Date(timestamp)
	date.setHours(0, 0, 0, 0)
	return date.getTime()
}

export function syncLogGroupLabel(timestamp: number, now: number): string {
	if (now - timestamp < JUST_NOW_MS) return "Just now"
	const today = startOfDay(now)
	if (timestamp >= today) return "Earlier today"
	if (timestamp >= today - 86_400_000) return "Yesterday"
	return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function buildSyncLogItems(entries: readonly SyncLogEntry[]): SyncLogItem[] {
	const items: SyncLogItem[] = []
	for (let index = entries.length - 1; index >= 0; index--) {
		const entry = entries[index]
		if (!entry) continue
		const presentation = describeSyncLogEntry(entry)
		const previous = items.at(-1)
		if (
			previous &&
			isAggregatable(presentation.kind) &&
			previous.kind === presentation.kind &&
			previous.entries[0] &&
			previous.entries[0].timestamp - entry.timestamp <= AGGREGATE_WINDOW_MS
		) {
			previous.entries.push(entry)
			for (const path of presentation.paths) {
				if (!previous.paths.includes(path)) previous.paths.push(path)
			}
			continue
		}
		items.push({
			...presentation,
			paths: [...presentation.paths],
			id: entry.id,
			level: entry.level,
			timestamp: entry.timestamp,
			entries: [entry],
		})
	}
	return items.map((item) => ({ ...item, title: aggregateTitle(item) }))
}

export function groupSyncLogItems(items: readonly SyncLogItem[], now: number): SyncLogGroup[] {
	const groups: SyncLogGroup[] = []
	for (const item of items) {
		const label = syncLogGroupLabel(item.timestamp, now)
		const last = groups.at(-1)
		if (last?.label === label) last.items.push(item)
		else groups.push({ label, items: [item] })
	}
	return groups
}
