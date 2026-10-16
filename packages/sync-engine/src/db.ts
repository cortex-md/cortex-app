import type { NoteSyncMetadata } from "@cortex/platform"
import { VAULT_FILES } from "@cortex/platform/utils"
import { type SqlDatabase, type SqlStatement, type SqlValue, syncRuntime } from "./runtime"

const SCHEMA_VERSION = 4

export type SyncStatus = "synced" | "conflict"

export interface FileState {
	filePath: string
	localHash: string | null
	remoteHash: string | null
	ancestorHash: string | null
	localMtime: number | null
	localSize: number | null
	syncStatus: SyncStatus
	serverVersion: number | null
}

export type NoteMetadataRecord = Omit<NoteSyncMetadata, "synced">

export interface MemberKeyPin {
	userId: string
	fingerprint: string
	pendingFingerprint: string | null
}

export interface QueueRow {
	id: string
	opKey: string
	opType: string
	op: string
	sourceEventId: string | null
	priority: number
	retryCount: number
	createdAt: number
	nextRetryAt: number | null
}

const SCHEMA = `
	CREATE TABLE fileState (
		filePath TEXT PRIMARY KEY,
		localHash TEXT,
		remoteHash TEXT,
		ancestorHash TEXT,
		localMtime INTEGER,
		localSize INTEGER,
		syncStatus TEXT NOT NULL,
		serverVersion INTEGER
	);
	CREATE INDEX fileStateStatus ON fileState(syncStatus);
	CREATE TABLE queue (
		id TEXT PRIMARY KEY,
		opKey TEXT NOT NULL,
		opType TEXT NOT NULL,
		op TEXT NOT NULL,
		sourceEventId TEXT,
		priority INTEGER NOT NULL,
		retryCount INTEGER NOT NULL DEFAULT 0,
		createdAt INTEGER NOT NULL,
		nextRetryAt INTEGER
	);
	CREATE INDEX queueKey ON queue(opKey);
	CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
	CREATE TABLE noteMetadata (
		filePath TEXT PRIMARY KEY,
		createdAt TEXT,
		createdBy TEXT,
		lastEditedAt TEXT,
		lastEditedBy TEXT,
		lastDeviceId TEXT
	);
	CREATE TABLE memberKeyPins (
		userId TEXT PRIMARY KEY,
		fingerprint TEXT NOT NULL,
		pendingFingerprint TEXT
	);
`

const MIGRATIONS: Record<number, string> = {
	2: `
		ALTER TABLE fileState ADD COLUMN serverVersion INTEGER;
		ALTER TABLE fileState DROP COLUMN serverVersionId;
		ALTER TABLE fileState DROP COLUMN remoteMtime;
		ALTER TABLE fileState DROP COLUMN lastSyncedAt;
		ALTER TABLE noteMetadata DROP COLUMN creationLookupComplete;
		DELETE FROM queue WHERE status = 'dead' OR opType = 'lookupCreationMetadata';
		ALTER TABLE queue DROP COLUMN status;
		ALTER TABLE queue DROP COLUMN maxRetries;
		ALTER TABLE queue DROP COLUMN lastError;
	`,
	3: `
	CREATE TABLE memberKeyPins (
		userId TEXT PRIMARY KEY,
		fingerprint TEXT NOT NULL,
		pendingFingerprint TEXT
	);
	`,
}

export function syncDbPath(vaultPath: string): string {
	return syncRuntime().path.join(vaultPath, VAULT_FILES.syncDb)
}

function prepareStatements(db: SqlDatabase) {
	return {
		getFile: db.prepare("SELECT * FROM fileState WHERE filePath = ?"),
		listFiles: db.prepare("SELECT * FROM fileState"),
		listConflicts: db.prepare("SELECT * FROM fileState WHERE syncStatus = 'conflict'"),
		upsertFile: db.prepare(`INSERT INTO fileState (
				filePath, localHash, remoteHash, ancestorHash, localMtime, localSize, syncStatus,
				serverVersion
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(filePath) DO UPDATE SET
				localHash = excluded.localHash,
				remoteHash = excluded.remoteHash,
				ancestorHash = excluded.ancestorHash,
				localMtime = excluded.localMtime,
				localSize = excluded.localSize,
				syncStatus = excluded.syncStatus,
				serverVersion = excluded.serverVersion`),
		deleteFile: db.prepare("DELETE FROM fileState WHERE filePath = ?"),
		renameFile: db.prepare("UPDATE fileState SET filePath = ? WHERE filePath = ?"),
		getNote: db.prepare(`SELECT n.*, f.syncStatus FROM noteMetadata n
			LEFT JOIN fileState f ON f.filePath = n.filePath WHERE n.filePath = ?`),
		upsertNote: db.prepare(`INSERT INTO noteMetadata (
				filePath, createdAt, createdBy, lastEditedAt, lastEditedBy, lastDeviceId
			) VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(filePath) DO UPDATE SET
				createdAt = COALESCE(noteMetadata.createdAt, excluded.createdAt),
				createdBy = COALESCE(noteMetadata.createdBy, excluded.createdBy),
				lastEditedAt = COALESCE(excluded.lastEditedAt, noteMetadata.lastEditedAt),
				lastEditedBy = COALESCE(excluded.lastEditedBy, noteMetadata.lastEditedBy),
				lastDeviceId = COALESCE(excluded.lastDeviceId, noteMetadata.lastDeviceId)`),
		deleteNote: db.prepare("DELETE FROM noteMetadata WHERE filePath = ?"),
		renameNote: db.prepare("UPDATE noteMetadata SET filePath = ? WHERE filePath = ?"),
		insertQueue: db.prepare(`INSERT INTO queue (
				id, opKey, opType, op, sourceEventId, priority, retryCount, createdAt, nextRetryAt
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
		dueQueue: db.prepare(`SELECT * FROM queue
			WHERE nextRetryAt IS NULL OR nextRetryAt <= ?
			ORDER BY priority DESC, rowid ASC`),
		queueByKey: db.prepare("SELECT * FROM queue WHERE opKey = ?"),
		deleteQueueByKey: db.prepare("DELETE FROM queue WHERE opKey = ?"),
		deleteQueueById: db.prepare("DELETE FROM queue WHERE id = ?"),
		retryQueueNow: db.prepare("UPDATE queue SET nextRetryAt = NULL WHERE nextRetryAt IS NOT NULL"),
		retryQueue: db.prepare(
			"UPDATE queue SET retryCount = retryCount + 1, nextRetryAt = ? WHERE id = ?",
		),
		deferQueue: db.prepare("UPDATE queue SET nextRetryAt = ? WHERE id = ?"),
		firstQueuedEventAfter: db.prepare(`SELECT MIN(CAST(sourceEventId AS INTEGER)) AS eventId
			FROM queue WHERE sourceEventId IS NOT NULL AND CAST(sourceEventId AS INTEGER) > ?`),
		getPin: db.prepare("SELECT * FROM memberKeyPins WHERE userId = ?"),
		listPinIssues: db.prepare(
			"SELECT * FROM memberKeyPins WHERE pendingFingerprint IS NOT NULL ORDER BY userId",
		),
		upsertPin: db.prepare(`INSERT INTO memberKeyPins (userId, fingerprint, pendingFingerprint)
			VALUES (?, ?, ?)
			ON CONFLICT(userId) DO UPDATE SET
				fingerprint = excluded.fingerprint,
				pendingFingerprint = excluded.pendingFingerprint`),
		getMeta: db.prepare("SELECT value FROM meta WHERE key = ?"),
		setMeta: db.prepare(
			"INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		),
	} satisfies Record<string, SqlStatement>
}

function nullable<T>(value: T | undefined): T | null {
	return value === undefined ? null : value
}

function toFileState(row: unknown): FileState | null {
	return (row as FileState | undefined) ?? null
}

export class SyncDb {
	private readonly db: SqlDatabase
	private readonly sql: ReturnType<typeof prepareStatements>
	private transactionDepth = 0

	constructor(readonly vaultPath: string) {
		const path = syncDbPath(vaultPath)
		syncRuntime().fs.mkdirSync(syncRuntime().path.join(vaultPath, ".cortex"))
		this.db = syncRuntime().openDatabase(path)
		this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;")
		this.migrate()
		this.sql = prepareStatements(this.db)
	}

	private migrate(): void {
		let { user_version: version } = this.db.prepare("PRAGMA user_version").get() as {
			user_version: number
		}
		if (version === SCHEMA_VERSION) return
		this.transaction(() => {
			if (MIGRATIONS[version] === undefined) {
				this.dropAllTables()
				this.db.exec(SCHEMA)
				version = SCHEMA_VERSION
			}
			for (; version < SCHEMA_VERSION; version += 1) this.db.exec(MIGRATIONS[version] as string)
			this.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
		})
	}

	private dropAllTables(): void {
		const tables = this.db
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
			.all() as Array<{ name: string }>
		for (const { name } of tables) this.db.exec(`DROP TABLE "${name.replaceAll('"', '""')}"`)
	}

	transaction<T>(fn: () => T): T {
		if (this.transactionDepth > 0) return fn()
		this.db.exec("BEGIN")
		this.transactionDepth += 1
		try {
			const result = fn()
			this.db.exec("COMMIT")
			return result
		} catch (error) {
			this.db.exec("ROLLBACK")
			throw error
		} finally {
			this.transactionDepth -= 1
		}
	}

	getFileState(filePath: string): FileState | null {
		return toFileState(this.sql.getFile.get(filePath))
	}

	listFileStates(): FileState[] {
		return this.sql.listFiles.all() as unknown as FileState[]
	}

	listConflicts(): FileState[] {
		return this.sql.listConflicts.all() as unknown as FileState[]
	}

	upsertFileState(state: FileState): void {
		this.sql.upsertFile.run(
			state.filePath,
			state.localHash,
			state.remoteHash,
			state.ancestorHash,
			state.localMtime,
			state.localSize,
			state.syncStatus,
			state.serverVersion,
		)
	}

	deleteFileState(filePath: string): void {
		this.sql.deleteFile.run(filePath)
	}

	renamePath(oldPath: string, newPath: string): void {
		this.transaction(() => {
			this.sql.deleteFile.run(newPath)
			this.sql.renameFile.run(newPath, oldPath)
			this.sql.deleteNote.run(newPath)
			this.sql.renameNote.run(newPath, oldPath)
		})
	}

	getNoteMetadata(filePath: string): NoteSyncMetadata | null {
		const row = this.sql.getNote.get(filePath) as
			| (NoteMetadataRecord & { syncStatus: string | null })
			| undefined
		if (!row) return null
		return {
			createdAt: row.createdAt,
			createdBy: row.createdBy,
			lastEditedAt: row.lastEditedAt,
			lastEditedBy: row.lastEditedBy,
			lastDeviceId: row.lastDeviceId,
			synced: row.syncStatus === "synced",
		}
	}

	upsertNoteMetadata(filePath: string, metadata: NoteMetadataRecord): void {
		this.sql.upsertNote.run(
			filePath,
			metadata.createdAt,
			metadata.createdBy,
			metadata.lastEditedAt,
			metadata.lastEditedBy,
			metadata.lastDeviceId,
		)
	}

	insertQueueRow(row: QueueRow): void {
		const values: SqlValue[] = [
			row.id,
			row.opKey,
			row.opType,
			row.op,
			nullable(row.sourceEventId),
			row.priority,
			row.retryCount,
			row.createdAt,
			nullable(row.nextRetryAt),
		]
		this.sql.insertQueue.run(...values)
	}

	replaceQueueRow(row: QueueRow): void {
		this.transaction(() => {
			this.sql.deleteQueueByKey.run(row.opKey)
			this.insertQueueRow(row)
		})
	}

	listDueQueue(now: number): QueueRow[] {
		return this.sql.dueQueue.all(now) as unknown as QueueRow[]
	}

	queueRowsByKey(opKey: string): QueueRow[] {
		return this.sql.queueByKey.all(opKey) as unknown as QueueRow[]
	}

	deleteQueueRow(id: string): void {
		this.sql.deleteQueueById.run(id)
	}

	retryQueueRow(id: string, nextRetryAt: number): void {
		this.sql.retryQueue.run(nextRetryAt, id)
	}

	retryQueueNow(): void {
		this.sql.retryQueueNow.run()
	}

	deferQueueRow(id: string, nextRetryAt: number): void {
		this.sql.deferQueue.run(nextRetryAt, id)
	}

	firstQueuedEventAfter(eventId: number): number | null {
		return (this.sql.firstQueuedEventAfter.get(eventId) as { eventId: number | null }).eventId
	}

	getMemberKeyPin(userId: string): MemberKeyPin | null {
		return (this.sql.getPin.get(userId) as MemberKeyPin | undefined) ?? null
	}

	listMemberKeyIssues(): MemberKeyPin[] {
		return this.sql.listPinIssues.all() as unknown as MemberKeyPin[]
	}

	setMemberKeyPin(pin: MemberKeyPin): void {
		this.sql.upsertPin.run(pin.userId, pin.fingerprint, pin.pendingFingerprint)
	}

	getMeta(key: string): string | null {
		return (this.sql.getMeta.get(key) as { value: string } | undefined)?.value ?? null
	}

	setMeta(key: string, value: string): void {
		this.sql.setMeta.run(key, value)
	}

	close(): void {
		if (this.db.isOpen) this.db.close()
	}
}
