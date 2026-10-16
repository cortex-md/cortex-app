import type { ConflictResolution } from "@cortex/platform"
import type { QueueRow, SyncDb } from "./db"
import { syncRuntime } from "./runtime"
import { nowSeconds } from "./util"

export type SyncOp =
	| { type: "upload"; path: string }
	| { type: "download"; path: string; version: number }
	| { type: "restore"; path: string }
	| { type: "delete"; path: string }
	| { type: "rename"; oldPath: string; newPath: string }
	| { type: "deleteRemote"; path: string }
	| { type: "renameRemote"; oldPath: string; newPath: string }
	| { type: "resolveConflict"; path: string; resolution: ConflictResolution }
	| { type: "settle"; path: string }

export interface QueueItem {
	id: string
	priority: number
	op: SyncOp
	sourceEventId: string | null
	retryCount: number
}

const MAX_RETRIES = 10

const PRIORITY: Record<SyncOp["type"], number> = {
	resolveConflict: 100,
	download: 80,
	restore: 80,
	delete: 80,
	rename: 80,
	upload: 60,
	deleteRemote: 60,
	renameRemote: 60,
	settle: 60,
}

const RETRY_BACKOFF_SECONDS = [30, 120, 600, 1800, 7200]

export function retryBackoffSecs(retryCount: number): number {
	return RETRY_BACKOFF_SECONDS[retryCount] ?? 21600
}

export function opPath(op: SyncOp): string {
	return "path" in op ? op.path : op.oldPath
}

export function opTargetPath(op: SyncOp): string {
	return "path" in op ? op.path : op.newPath
}

function opKey(op: SyncOp): string {
	return `${op.type}:${opPath(op)}`
}

function eventNumber(eventId: string): number {
	const parsed = Number(eventId)
	if (!Number.isFinite(parsed)) throw new Error(`Event ID is not numeric: ${eventId}`)
	return parsed
}

function latestEventId(left: string | null, right: string | null): string | null {
	if (!left) return right
	if (!right) return left
	return eventNumber(left) >= eventNumber(right) ? left : right
}

function itemFromRow(row: QueueRow): QueueItem | null {
	try {
		return {
			id: row.id,
			priority: row.priority,
			op: JSON.parse(row.op) as SyncOp,
			sourceEventId: row.sourceEventId,
			retryCount: row.retryCount,
		}
	} catch {
		return null
	}
}

export class SyncQueue {
	private items: QueueItem[] = []
	private readonly byKey = new Map<string, QueueItem>()
	private readonly running = new Set<string>()

	constructor(private readonly db: SyncDb | null = null) {}

	get size(): number {
		return this.items.length
	}

	load(): number {
		if (!this.db) return 0
		const known = new Set([...this.running, ...this.items.map((item) => item.id)])
		let loaded = 0
		for (const row of this.db.listDueQueue(nowSeconds())) {
			if (known.has(row.id)) continue
			const item = itemFromRow(row)
			if (!item) {
				this.db.deleteQueueRow(row.id)
				continue
			}
			this.insert(item)
			loaded += 1
		}
		return loaded
	}

	push(op: SyncOp, sourceEventId: string | null = null): void {
		const key = opKey(op)
		let eventId = sourceEventId
		let next = op
		const merge = (existing: SyncOp, existingEventId: string | null) => {
			eventId = latestEventId(eventId, existingEventId)
			if (next.type === "download" && existing.type === "download") {
				next = { ...next, version: Math.max(next.version, existing.version) }
			}
		}
		const queued = this.byKey.get(key)
		if (queued) merge(queued.op, queued.sourceEventId)
		for (const row of this.db?.queueRowsByKey(key) ?? []) {
			const item = itemFromRow(row)
			if (item) merge(item.op, item.sourceEventId)
		}

		const item: QueueItem = {
			id: syncRuntime().randomUUID(),
			priority: PRIORITY[next.type],
			op: next,
			sourceEventId: eventId,
			retryCount: 0,
		}
		if (queued) this.remove(queued)
		this.db?.replaceQueueRow({
			id: item.id,
			opKey: key,
			opType: next.type,
			op: JSON.stringify(next),
			sourceEventId: eventId,
			priority: item.priority,
			retryCount: 0,
			createdAt: nowSeconds(),
			nextRetryAt: null,
		})
		this.insert(item)
	}

	pop(): QueueItem | undefined {
		const item = this.items.shift()
		if (item) {
			this.byKey.delete(opKey(item.op))
			this.running.add(item.id)
		}
		return item
	}

	popWhile(type: SyncOp["type"], limit: number): QueueItem[] {
		let count = 0
		while (count < limit && this.items[count]?.op.type === type) count += 1
		const items = this.items.splice(0, count)
		for (const item of items) {
			this.byKey.delete(opKey(item.op))
			this.running.add(item.id)
		}
		return items
	}

	complete(item: QueueItem): void {
		this.running.delete(item.id)
		this.db?.deleteQueueRow(item.id)
	}

	defer(item: QueueItem, delaySeconds: number): void {
		this.running.delete(item.id)
		this.db?.deferQueueRow(item.id, nowSeconds() + Math.max(1, Math.ceil(delaySeconds)))
	}

	fail(item: QueueItem, retriable: boolean): boolean {
		this.running.delete(item.id)
		if (!retriable || item.retryCount + 1 >= MAX_RETRIES) {
			this.db?.deleteQueueRow(item.id)
			return false
		}
		this.db?.retryQueueRow(item.id, nowSeconds() + retryBackoffSecs(item.retryCount))
		return true
	}

	private insert(item: QueueItem): void {
		let low = 0
		let high = this.items.length
		while (low < high) {
			const middle = (low + high) >>> 1
			if ((this.items[middle]?.priority ?? 0) >= item.priority) low = middle + 1
			else high = middle
		}
		this.items.splice(low, 0, item)
		this.byKey.set(opKey(item.op), item)
	}

	private remove(item: QueueItem): void {
		const index = this.items.indexOf(item)
		if (index !== -1) this.items.splice(index, 1)
		this.byKey.delete(opKey(item.op))
	}
}
