import type { QueueRow, SyncDb } from "./db"
import type { ConflictResolution } from "./state"

export type SyncOp =
	| { type: "upload"; path: string }
	| { type: "download"; path: string; version: number }
	| { type: "delete"; path: string }
	| { type: "rename"; oldPath: string; newPath: string }
	| { type: "deleteRemote"; path: string }
	| { type: "renameRemote"; oldPath: string; newPath: string }
	| { type: "resolveConflict"; path: string; resolution: ConflictResolution | null }
	| { type: "lookupCreationMetadata"; path: string }
	| { type: "initialSync" }
	| { type: "reconcile" }

export interface QueueItem {
	id: string
	priority: number
	op: SyncOp
	sourceEventId: string | null
	retryCount: number
	maxRetries: number
}

function nowSecs(): number {
	return Math.floor(Date.now() / 1000)
}

function newId(): string {
	const ts = process.hrtime.bigint().toString(16)
	const rand = Math.floor(Math.random() * 0xffff)
		.toString(16)
		.padStart(4, "0")
	return `${ts}-${rand}`
}

function opType(op: SyncOp): string {
	switch (op.type) {
		case "upload":
			return "upload"
		case "download":
			return "download"
		case "delete":
			return "delete"
		case "deleteRemote":
			return "delete_remote"
		case "rename":
			return "rename"
		case "renameRemote":
			return "rename_remote"
		case "resolveConflict":
			return "resolve_conflict"
		case "lookupCreationMetadata":
			return "lookup_creation_metadata"
		case "initialSync":
			return "initial_sync"
		case "reconcile":
			return "reconcile"
	}
}

function opPath(op: SyncOp): string {
	switch (op.type) {
		case "upload":
		case "download":
		case "delete":
		case "deleteRemote":
		case "resolveConflict":
		case "lookupCreationMetadata":
			return op.path
		case "rename":
		case "renameRemote":
			return op.oldPath
		case "initialSync":
		case "reconcile":
			return ""
	}
}

function opExtraData(op: SyncOp): string | null {
	switch (op.type) {
		case "download":
			return String(op.version)
		case "rename":
		case "renameRemote":
			return op.newPath
		case "resolveConflict":
			return op.resolution ? JSON.stringify(op.resolution) : null
		default:
			return null
	}
}

function syncOpFromRow(row: QueueRow): SyncOp | null {
	switch (row.opType) {
		case "upload":
			return { type: "upload", path: row.path }
		case "download":
			return {
				type: "download",
				path: row.path,
				version: Number(row.extraData ?? "1") || 1,
			}
		case "delete":
			return { type: "delete", path: row.path }
		case "delete_remote":
			return { type: "deleteRemote", path: row.path }
		case "rename_remote":
			return {
				type: "renameRemote",
				oldPath: row.path,
				newPath: row.extraData ?? "",
			}
		case "rename":
			return {
				type: "rename",
				oldPath: row.path,
				newPath: row.extraData ?? "",
			}
		case "resolve_conflict": {
			let resolution: ConflictResolution | null = null
			if (row.extraData) {
				try {
					resolution = JSON.parse(row.extraData) as ConflictResolution
				} catch {
					resolution = null
				}
			}
			return { type: "resolveConflict", path: row.path, resolution }
		}
		case "lookup_creation_metadata":
			return { type: "lookupCreationMetadata", path: row.path }
		case "initial_sync":
			return { type: "initialSync" }
		case "reconcile":
			return { type: "reconcile" }
		default:
			return null
	}
}

function parseSourceEventId(eventId: string): number {
	const parsed = Number(eventId)
	if (!Number.isFinite(parsed)) {
		throw new Error(`source event ID is not numeric: ${eventId}`)
	}
	return parsed
}

function highestSourceEventId(
	left: string | null | undefined,
	right: string | null | undefined,
): string | null {
	if (left && right) {
		return parseSourceEventId(left) >= parseSourceEventId(right) ? left : right
	}
	if (left) {
		parseSourceEventId(left)
		return left
	}
	if (right) {
		parseSourceEventId(right)
		return right
	}
	return null
}

export function retryBackoffSecs(retryCount: number): number {
	switch (retryCount) {
		case 0:
			return 30
		case 1:
			return 120
		case 2:
			return 600
		case 3:
			return 1800
		case 4:
			return 7200
		default:
			return 21600
	}
}

export class SyncQueue {
	private items: QueueItem[] = []
	private db: SyncDb | null = null

	static withDb(db: SyncDb): SyncQueue {
		const queue = new SyncQueue()
		queue.setDb(db)
		return queue
	}

	setDb(db: SyncDb): void {
		this.db = db
	}

	loadFromDb(): number {
		if (!this.db) return 0
		const rows = this.db.loadPendingQueue(nowSecs())
		for (const row of rows) {
			const op = syncOpFromRow(row)
			if (!op) continue
			this.items.push({
				id: row.id,
				priority: row.priority,
				op,
				sourceEventId: row.sourceEventId,
				retryCount: row.retryCount,
				maxRetries: row.maxRetries,
			})
		}
		this.sort()
		return rows.length
	}

	push(op: SyncOp, priority: number): void {
		this.pushInternal(op, priority, null)
	}

	pushFromEvent(op: SyncOp, priority: number, eventId: string): void {
		this.pushInternal(op, priority, eventId)
	}

	private pushInternal(op: SyncOp, priority: number, sourceEventId: string | null): void {
		let nextSourceEventId = sourceEventId
		const type = opType(op)
		const path = opPath(op)
		let existingDownloadVersion: number | null = null

		for (const item of this.items) {
			if (opType(item.op) !== type || opPath(item.op) !== path) continue
			nextSourceEventId = highestSourceEventId(nextSourceEventId, item.sourceEventId)
			if (item.op.type === "download") {
				existingDownloadVersion = Math.max(existingDownloadVersion ?? 0, item.op.version)
			}
		}

		if (this.db) {
			for (const row of this.db.loadDuplicateQueueOps(type, path)) {
				nextSourceEventId = highestSourceEventId(nextSourceEventId, row.sourceEventId)
				if (type === "download" && row.extraData) {
					const version = Number(row.extraData)
					if (Number.isFinite(version)) {
						existingDownloadVersion = Math.max(existingDownloadVersion ?? 0, version)
					}
				}
			}
		}

		let nextOp = op
		if (nextOp.type === "download" && existingDownloadVersion !== null) {
			nextOp = {
				...nextOp,
				version: Math.max(nextOp.version, existingDownloadVersion),
			}
		}

		this.items = this.items.filter((item) => opType(item.op) !== type || opPath(item.op) !== path)
		const id = newId()

		if (this.db) {
			this.db.removeDuplicateQueueOp(type, path)
			this.db.enqueueOp({
				id,
				opType: opType(nextOp),
				path: opPath(nextOp),
				extraData: opExtraData(nextOp),
				sourceEventId: nextSourceEventId,
				priority,
				retryCount: 0,
				maxRetries: 10,
				createdAt: nowSecs(),
				nextRetryAt: null,
				lastError: null,
				status: "pending",
			})
		}

		this.items.push({
			id,
			priority,
			op: nextOp,
			sourceEventId: nextSourceEventId,
			retryCount: 0,
			maxRetries: 10,
		})
		this.sort()
	}

	pop(): QueueItem | undefined {
		return this.items.shift()
	}

	markCompleted(item: QueueItem): void {
		this.db?.markQueueCompleted(item.id)
	}

	markFailed(item: QueueItem, error: string, retriable: boolean): void {
		if (!retriable || item.retryCount + 1 >= item.maxRetries) {
			this.db?.markQueueDead(item.id, error)
			return
		}
		const nextRetry = nowSecs() + retryBackoffSecs(item.retryCount)
		this.db?.markQueueFailed(item.id, error, nextRetry)
	}

	isEmpty(): boolean {
		return this.items.length === 0
	}

	len(): number {
		return this.items.length
	}

	clear(): void {
		this.items = []
		this.db?.clearQueue()
	}

	reloadReady(): number {
		if (!this.db) return 0
		const rows = this.db.loadPendingQueue(nowSecs())
		const existingIds = new Set(this.items.map((item) => item.id))
		let loaded = 0
		for (const row of rows) {
			if (existingIds.has(row.id)) continue
			const op = syncOpFromRow(row)
			if (!op) continue
			this.items.push({
				id: row.id,
				priority: row.priority,
				op,
				sourceEventId: row.sourceEventId,
				retryCount: row.retryCount,
				maxRetries: row.maxRetries,
			})
			loaded += 1
		}
		this.sort()
		return loaded
	}

	private sort(): void {
		this.items.sort((left, right) => right.priority - left.priority)
	}

	static upload(path: string): [SyncOp, number] {
		return [{ type: "upload", path }, 60]
	}

	static download(path: string, version: number): [SyncOp, number] {
		return [{ type: "download", path, version }, 80]
	}

	static deleteRemote(path: string): [SyncOp, number] {
		return [{ type: "deleteRemote", path }, 60]
	}

	static renameRemote(oldPath: string, newPath: string): [SyncOp, number] {
		return [{ type: "renameRemote", oldPath, newPath }, 60]
	}

	static conflict(path: string): [SyncOp, number] {
		return [{ type: "resolveConflict", path, resolution: null }, 100]
	}

	static lookupCreationMetadata(path: string): [SyncOp, number] {
		return [{ type: "lookupCreationMetadata", path }, 10]
	}

	static initialSync(): [SyncOp, number] {
		return [{ type: "initialSync" }, 20]
	}

	static reconcile(): [SyncOp, number] {
		return [{ type: "reconcile" }, 90]
	}
}
