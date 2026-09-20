import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)

export interface SyncStateRow {
	filePath: string
	localHash: string | null
	remoteHash: string | null
	ancestorHash: string | null
	localMtime: number | null
	remoteMtime: number | null
	syncStatus: string
	lastSyncedAt: number | null
	serverVersionId: string | null
}

export interface NoteSyncMetadata {
	createdAt: string | null
	createdBy: string | null
	lastEditedAt: string | null
	lastEditedBy: string | null
	lastDeviceId: string | null
	synced: boolean
	creationLookupComplete: boolean
}

export interface QueueRow {
	id: string
	opType: string
	path: string
	extraData: string | null
	sourceEventId: string | null
	priority: number
	retryCount: number
	maxRetries: number
	createdAt: number
	nextRetryAt: number | null
	lastError: string | null
	status: string
}

interface SqlStatement {
	run(...params: unknown[]): unknown
	get(...params: unknown[]): unknown
	all(...params: unknown[]): unknown[]
}

interface SqlDatabase {
	exec(sql: string): unknown
	prepare(sql: string): SqlStatement
	pragma?(sql: string): unknown
	close(): void
}

function openSqlite(dbPath: string): SqlDatabase {
	try {
		const { Database } = require("bun:sqlite") as {
			Database: new (
				path: string,
			) => {
				exec(sql: string): unknown
				prepare(sql: string): SqlStatement
				close(): void
			}
		}
		const db = new Database(dbPath)
		return {
			exec: (sql) => db.exec(sql),
			prepare: (sql) => db.prepare(sql),
			close: () => db.close(),
		}
	} catch {
		// Fall through to Node / better-sqlite3.
	}

	try {
		const { DatabaseSync } = require("node:sqlite") as {
			DatabaseSync: new (
				path: string,
			) => {
				exec(sql: string): unknown
				prepare(sql: string): SqlStatement
				close(): void
			}
		}
		const db = new DatabaseSync(dbPath)
		return {
			exec: (sql) => db.exec(sql),
			prepare: (sql) => db.prepare(sql),
			close: () => db.close(),
		}
	} catch {
		// Fall through to better-sqlite3 for Electron rebuilds.
	}

	const BetterSqlite = require("better-sqlite3") as {
		new (
			path: string,
		): {
			exec(sql: string): unknown
			prepare(sql: string): SqlStatement
			close(): void
		}
	}
	const db = new BetterSqlite(dbPath)
	return {
		exec: (sql) => db.exec(sql),
		prepare: (sql) => db.prepare(sql),
		close: () => db.close(),
	}
}

interface SyncStateDbRow {
	file_path: string
	local_hash: string | null
	remote_hash: string | null
	ancestor_hash: string | null
	local_mtime: number | null
	remote_mtime: number | null
	sync_status: string
	last_synced_at: number | null
	server_version_id: string | null
}

interface NoteMetadataDbRow {
	created_at: string | null
	created_by: string | null
	last_edited_at: string | null
	last_edited_by: string | null
	last_device_id: string | null
	creation_lookup_complete: number
}

interface QueueDbRow {
	id: string
	op_type: string
	path: string
	extra_data: string | null
	source_event_id: string | null
	priority: number
	retry_count: number
	max_retries: number
	created_at: number
	next_retry_at: number | null
	last_error: string | null
	status: string
}

function mapSyncState(row: SyncStateDbRow): SyncStateRow {
	return {
		filePath: row.file_path,
		localHash: row.local_hash,
		remoteHash: row.remote_hash,
		ancestorHash: row.ancestor_hash,
		localMtime: row.local_mtime,
		remoteMtime: row.remote_mtime,
		syncStatus: row.sync_status,
		lastSyncedAt: row.last_synced_at,
		serverVersionId: row.server_version_id,
	}
}

function mapQueueRow(row: QueueDbRow): QueueRow {
	return {
		id: row.id,
		opType: row.op_type,
		path: row.path,
		extraData: row.extra_data,
		sourceEventId: row.source_event_id,
		priority: row.priority,
		retryCount: row.retry_count,
		maxRetries: row.max_retries,
		createdAt: row.created_at,
		nextRetryAt: row.next_retry_at,
		lastError: row.last_error,
		status: row.status,
	}
}

export class SyncDb {
	private readonly db: SqlDatabase

	constructor(vaultPath: string) {
		const dbPath = join(vaultPath, ".cortex", "sync.db")
		mkdirSync(dirname(dbPath), { recursive: true })
		this.db = openSqlite(dbPath)
		this.migrate()
	}

	static open(vaultPath: string): SyncDb {
		return new SyncDb(vaultPath)
	}

	private migrate(): void {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS sync_state (
				file_path TEXT PRIMARY KEY,
				local_hash TEXT,
				remote_hash TEXT,
				ancestor_hash TEXT,
				local_mtime INTEGER,
				remote_mtime INTEGER,
				sync_status TEXT NOT NULL DEFAULT 'unknown',
				last_synced_at INTEGER,
				server_version_id TEXT
			);
			CREATE TABLE IF NOT EXISTS sync_queue (
				id TEXT PRIMARY KEY,
				op_type TEXT NOT NULL,
				path TEXT NOT NULL,
				extra_data TEXT,
				source_event_id TEXT,
				priority INTEGER NOT NULL DEFAULT 60,
				retry_count INTEGER NOT NULL DEFAULT 0,
				max_retries INTEGER NOT NULL DEFAULT 10,
				created_at INTEGER NOT NULL,
				next_retry_at INTEGER,
				last_error TEXT,
				status TEXT NOT NULL DEFAULT 'pending'
			);
			CREATE TABLE IF NOT EXISTS sync_metadata (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS sync_note_metadata (
				file_path TEXT PRIMARY KEY,
				created_at TEXT,
				created_by TEXT,
				last_edited_at TEXT,
				last_edited_by TEXT,
				last_device_id TEXT,
				creation_lookup_complete INTEGER NOT NULL DEFAULT 0
			);
		`)

		const noteColumns = this.tableInfo("sync_note_metadata")
		if (!noteColumns.includes("creation_lookup_complete")) {
			this.db.exec(
				"ALTER TABLE sync_note_metadata ADD COLUMN creation_lookup_complete INTEGER NOT NULL DEFAULT 0",
			)
		}

		const queueColumns = this.tableInfo("sync_queue")
		if (!queueColumns.includes("source_event_id")) {
			this.db.exec("ALTER TABLE sync_queue ADD COLUMN source_event_id TEXT")
		}
	}

	private tableInfo(table: string): string[] {
		const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
		return rows.map((row) => row.name)
	}

	getSyncState(filePath: string): SyncStateRow | null {
		const row = this.db
			.prepare(
				`SELECT file_path, local_hash, remote_hash, ancestor_hash, local_mtime, remote_mtime,
				sync_status, last_synced_at, server_version_id FROM sync_state WHERE file_path = ?`,
			)
			.get(filePath) as SyncStateDbRow | undefined
		return row ? mapSyncState(row) : null
	}

	upsertSyncState(state: SyncStateRow): void {
		this.db
			.prepare(
				`INSERT INTO sync_state (
					file_path, local_hash, remote_hash, ancestor_hash, local_mtime, remote_mtime,
					sync_status, last_synced_at, server_version_id
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(file_path) DO UPDATE SET
					local_hash = excluded.local_hash,
					remote_hash = excluded.remote_hash,
					ancestor_hash = excluded.ancestor_hash,
					local_mtime = excluded.local_mtime,
					remote_mtime = excluded.remote_mtime,
					sync_status = excluded.sync_status,
					last_synced_at = excluded.last_synced_at,
					server_version_id = excluded.server_version_id`,
			)
			.run(
				state.filePath,
				state.localHash,
				state.remoteHash,
				state.ancestorHash,
				state.localMtime,
				state.remoteMtime,
				state.syncStatus,
				state.lastSyncedAt,
				state.serverVersionId,
			)
	}

	listAllSyncStates(): SyncStateRow[] {
		const rows = this.db
			.prepare(
				`SELECT file_path, local_hash, remote_hash, ancestor_hash, local_mtime, remote_mtime,
				sync_status, last_synced_at, server_version_id FROM sync_state`,
			)
			.all() as SyncStateDbRow[]
		return rows.map(mapSyncState)
	}

	deleteSyncState(filePath: string): void {
		this.db.prepare("DELETE FROM sync_state WHERE file_path = ?").run(filePath)
	}

	getNoteMetadata(filePath: string): NoteSyncMetadata | null {
		const row = this.db
			.prepare(
				`SELECT created_at, created_by, last_edited_at, last_edited_by, last_device_id,
				creation_lookup_complete FROM sync_note_metadata WHERE file_path = ?`,
			)
			.get(filePath) as NoteMetadataDbRow | undefined
		if (!row) return null
		const syncState = this.getSyncState(filePath)
		return {
			createdAt: row.created_at,
			createdBy: row.created_by,
			lastEditedAt: row.last_edited_at,
			lastEditedBy: row.last_edited_by,
			lastDeviceId: row.last_device_id,
			synced: syncState?.syncStatus === "synced",
			creationLookupComplete: row.creation_lookup_complete === 1,
		}
	}

	upsertNoteMetadata(filePath: string, metadata: NoteSyncMetadata): void {
		this.db
			.prepare(
				`INSERT INTO sync_note_metadata (
					file_path, created_at, created_by, last_edited_at, last_edited_by, last_device_id,
					creation_lookup_complete
				) VALUES (?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(file_path) DO UPDATE SET
					created_at = COALESCE(sync_note_metadata.created_at, excluded.created_at),
					created_by = COALESCE(sync_note_metadata.created_by, excluded.created_by),
					last_edited_at = COALESCE(excluded.last_edited_at, sync_note_metadata.last_edited_at),
					last_edited_by = COALESCE(excluded.last_edited_by, sync_note_metadata.last_edited_by),
					last_device_id = COALESCE(excluded.last_device_id, sync_note_metadata.last_device_id),
					creation_lookup_complete = MAX(
						sync_note_metadata.creation_lookup_complete,
						excluded.creation_lookup_complete
					)`,
			)
			.run(
				filePath,
				metadata.createdAt,
				metadata.createdBy,
				metadata.lastEditedAt,
				metadata.lastEditedBy,
				metadata.lastDeviceId,
				metadata.creationLookupComplete ? 1 : 0,
			)
	}

	listIncompleteCreationMetadata(): string[] {
		const rows = this.db
			.prepare(
				`SELECT file_path FROM sync_note_metadata
				WHERE creation_lookup_complete = 0
				ORDER BY file_path`,
			)
			.all() as Array<{ file_path: string }>
		return rows.map((row) => row.file_path)
	}

	renameNoteMetadata(oldPath: string, newPath: string): void {
		this.db
			.prepare("UPDATE sync_note_metadata SET file_path = ? WHERE file_path = ?")
			.run(newPath, oldPath)
	}

	enqueueOp(row: QueueRow): void {
		this.db
			.prepare(
				`INSERT INTO sync_queue (
					id, op_type, path, extra_data, source_event_id, priority, retry_count, max_retries,
					created_at, next_retry_at, last_error, status
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
					source_event_id = excluded.source_event_id,
					retry_count = excluded.retry_count,
					next_retry_at = excluded.next_retry_at,
					last_error = excluded.last_error,
					status = excluded.status`,
			)
			.run(
				row.id,
				row.opType,
				row.path,
				row.extraData,
				row.sourceEventId,
				row.priority,
				row.retryCount,
				row.maxRetries,
				row.createdAt,
				row.nextRetryAt,
				row.lastError,
				row.status,
			)
	}

	loadPendingQueue(now: number): QueueRow[] {
		const rows = this.db
			.prepare(
				`SELECT id, op_type, path, extra_data, source_event_id, priority, retry_count, max_retries,
				created_at, next_retry_at, last_error, status
				FROM sync_queue
				WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= ?)
				ORDER BY priority DESC, created_at ASC`,
			)
			.all(now) as QueueDbRow[]
		return rows.map(mapQueueRow)
	}

	loadDuplicateQueueOps(opType: string, path: string): QueueRow[] {
		const rows = this.db
			.prepare(
				`SELECT id, op_type, path, extra_data, source_event_id, priority, retry_count, max_retries,
				created_at, next_retry_at, last_error, status
				FROM sync_queue
				WHERE op_type = ? AND path = ?`,
			)
			.all(opType, path) as QueueDbRow[]
		return rows.map(mapQueueRow)
	}

	listQueuedSourceEventIds(): string[] {
		const rows = this.db
			.prepare("SELECT source_event_id FROM sync_queue WHERE source_event_id IS NOT NULL")
			.all() as Array<{ source_event_id: string }>
		return rows.map((row) => row.source_event_id)
	}

	markQueueCompleted(id: string): void {
		this.db.prepare("DELETE FROM sync_queue WHERE id = ?").run(id)
	}

	markQueueFailed(id: string, error: string, nextRetryAt: number | null): void {
		this.db
			.prepare(
				`UPDATE sync_queue SET
					retry_count = retry_count + 1,
					last_error = ?,
					next_retry_at = ?,
					status = CASE WHEN retry_count + 1 >= max_retries THEN 'dead' ELSE 'pending' END
				WHERE id = ?`,
			)
			.run(error, nextRetryAt, id)
	}

	markQueueDead(id: string, error: string): void {
		this.db
			.prepare("UPDATE sync_queue SET status = 'dead', last_error = ? WHERE id = ?")
			.run(error, id)
	}

	removeDuplicateQueueOp(opType: string, path: string): void {
		this.db.prepare("DELETE FROM sync_queue WHERE op_type = ? AND path = ?").run(opType, path)
	}

	removeQueueOpsByType(opType: string): void {
		this.db.prepare("DELETE FROM sync_queue WHERE op_type = ?").run(opType)
	}

	clearQueue(): void {
		this.db.prepare("DELETE FROM sync_queue").run()
	}

	deadLetterCount(): number {
		const row = this.db
			.prepare("SELECT COUNT(*) AS count FROM sync_queue WHERE status = 'dead'")
			.get() as { count: number }
		return row.count
	}

	getMetadata(key: string): string | null {
		const row = this.db.prepare("SELECT value FROM sync_metadata WHERE key = ?").get(key) as
			| { value: string }
			| undefined
		return row?.value ?? null
	}

	setMetadata(key: string, value: string): void {
		this.db
			.prepare(
				`INSERT INTO sync_metadata (key, value) VALUES (?, ?)
				ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
			)
			.run(key, value)
	}

	deleteMetadata(key: string): void {
		this.db.prepare("DELETE FROM sync_metadata WHERE key = ?").run(key)
	}

	close(): void {
		this.db.close()
	}
}
