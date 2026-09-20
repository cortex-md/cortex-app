import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { decrypt, encrypt } from "./crypto"
import type { SyncDb, SyncStateRow } from "./db"
import { atomicWriteBytes } from "./fsAtomic"
import { hashContent } from "./hash"
import type { SyncHttpClient } from "./http"
import { type SyncPreferences, shouldIgnorePath } from "./ignore"
import { normalizeRelativePath } from "./paths"
import { urlencoded } from "./url"

export type SyncEventEmitter = (name: string, payload?: unknown) => void

export interface InitialSyncProgress {
	total: number
	completed: number
	phase: string
}

interface RemoteFileInfo {
	file_path: string
	checksum?: string | null
	version?: number | null
	snapshot_id?: string | null
	deleted?: boolean | null
	size_bytes?: number | null
	updated_at?: string | null
	created_at?: string | null
	last_modified_by?: string | null
	last_device_id?: string | null
}

interface LocalFileInfo {
	hash: string
	mtime: number | null
	size: number
}

type InitialSyncAction =
	| { type: "download"; path: string; version: number }
	| { type: "upload"; path: string }
	| { type: "conflict"; path: string }
	| { type: "delete"; path: string }

export class InitialSync {
	constructor(
		private readonly onEvent: SyncEventEmitter,
		private readonly client: SyncHttpClient,
		private readonly db: SyncDb,
		private readonly vaultId: string,
		private readonly vaultPath: string,
		private readonly vek: Buffer,
		private readonly syncPreferences: SyncPreferences,
	) {}

	async run(): Promise<void> {
		this.emitProgress(0, 0, "listing")
		const remoteFiles = await this.fetchRemoteFileList()
		for (const remote of remoteFiles) {
			this.db.upsertNoteMetadata(remote.file_path, {
				createdAt: remote.created_at ?? null,
				createdBy: remote.version === 1 ? (remote.last_modified_by ?? null) : null,
				lastEditedAt: remote.updated_at ?? null,
				lastEditedBy: remote.last_modified_by ?? null,
				lastDeviceId: remote.last_device_id ?? null,
				synced: true,
				creationLookupComplete: remote.version === 1,
			})
		}

		const localStates = this.db.listAllSyncStates()
		const localDiskFiles = this.scanLocalFiles()
		const actions = computeInitialActions(
			remoteFiles,
			localStates,
			localDiskFiles,
			this.syncPreferences,
		)
		const total = actions.length
		this.emitProgress(total, 0, "syncing")

		let completed = 0
		let firstError: string | null = null
		for (const action of actions) {
			try {
				switch (action.type) {
					case "download":
						this.emitFileEvent(action.path, "downloading")
						await this.downloadFile(action.path)
						this.emitLog("info", `Pulled: ${action.path}`)
						this.emitFileEvent(action.path, "synced")
						break
					case "upload":
						this.emitFileEvent(action.path, "uploading")
						await this.uploadFile(action.path)
						this.emitLog("info", `Pushed: ${action.path}`)
						this.emitFileEvent(action.path, "synced")
						break
					case "conflict":
						this.markConflict(action.path)
						break
					case "delete": {
						const fullPath = join(this.vaultPath, action.path)
						if (existsSync(fullPath)) unlinkSync(fullPath)
						this.db.deleteSyncState(action.path)
						this.emitFileEvent(action.path, "deleted")
						break
					}
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				this.emitLog("error", `${action.type} failed: ${action.path} — ${message}`)
				this.emitFileEvent(action.path, `error: ${message}`)
				firstError ??= message
			}
			completed += 1
			this.emitProgress(total, completed, "syncing")
		}

		if (firstError) throw new Error(firstError)
		this.emitProgress(total, total, "complete")
		this.onEvent("sync-initial-complete")
	}

	private async fetchRemoteFileList(): Promise<RemoteFileInfo[]> {
		const response = await this.client.get(`/sync/v1/vaults/${this.vaultId}/files/list`)
		if (!response.ok) {
			const body = await response.text()
			throw new Error(`Failed to list remote files: ${body}`)
		}
		return await response.json<RemoteFileInfo[]>()
	}

	private scanLocalFiles(): Map<string, LocalFileInfo> {
		const files = new Map<string, LocalFileInfo>()
		this.walkDir(this.vaultPath, files)
		return files
	}

	private walkDir(dir: string, files: Map<string, LocalFileInfo>): void {
		let entries: string[]
		try {
			entries = readdirSync(dir)
		} catch {
			return
		}
		for (const name of entries) {
			const fullPath = join(dir, name)
			const relative = normalizeRelativePath(fullPath.slice(this.vaultPath.length))
			if (shouldIgnorePath(relative, this.syncPreferences)) continue
			const stats = statSync(fullPath)
			if (stats.isDirectory()) {
				this.walkDir(fullPath, files)
				continue
			}
			const content = readFileSync(fullPath)
			files.set(relative, {
				hash: hashContent(content),
				mtime: Math.floor(stats.mtimeMs / 1000),
				size: content.length,
			})
		}
	}

	private async downloadFile(filePath: string): Promise<void> {
		const apiPath = `/sync/v1/vaults/${this.vaultId}/files?path=${urlencoded(filePath)}`
		const response = await this.client.get(apiPath)
		if (!response.ok) {
			const body = await response.text()
			throw new Error(`Download failed: ${body}`)
		}
		const snapshotId = response.headers.get("X-Snapshot-ID")
		const encrypted = await response.bytes()
		const plaintext = decrypt(encrypted, this.vek)
		const remoteHash = hashContent(plaintext)
		await atomicWriteBytes(join(this.vaultPath, filePath), plaintext)
		const now = Math.floor(Date.now() / 1000)
		this.db.upsertSyncState({
			filePath,
			localHash: remoteHash,
			remoteHash,
			ancestorHash: remoteHash,
			localMtime: now,
			remoteMtime: now,
			syncStatus: "synced",
			lastSyncedAt: now,
			serverVersionId: snapshotId,
		})
	}

	private async uploadFile(filePath: string): Promise<void> {
		const fullPath = join(this.vaultPath, filePath)
		const content = readFileSync(fullPath)
		const localHash = hashContent(content)
		const encrypted = encrypt(content, this.vek)
		const response = await this.client.postBytes(
			`/sync/v1/vaults/${this.vaultId}/files`,
			encrypted,
			[
				["X-File-Path", filePath],
				["X-Local-Hash", localHash],
				["Content-Type", "application/octet-stream"],
			],
		)
		if (!response.ok) {
			const body = await response.text()
			throw new Error(`Upload failed: ${body}`)
		}
		const responseBody = await response.json<{
			snapshot_id?: string
			version?: number
			created_at?: string
			updated_at?: string
			last_modified_by?: string
			last_device_id?: string
		}>()
		this.db.upsertNoteMetadata(filePath, {
			createdAt: responseBody.created_at ?? null,
			createdBy: responseBody.version === 1 ? (responseBody.last_modified_by ?? null) : null,
			lastEditedAt: responseBody.updated_at ?? null,
			lastEditedBy: responseBody.last_modified_by ?? null,
			lastDeviceId: responseBody.last_device_id ?? null,
			synced: true,
			creationLookupComplete: responseBody.version === 1,
		})
		let mtime: number | null = null
		try {
			mtime = Math.floor(statSync(fullPath).mtimeMs / 1000)
		} catch {
			mtime = null
		}
		const now = Math.floor(Date.now() / 1000)
		this.db.upsertSyncState({
			filePath,
			localHash,
			remoteHash: localHash,
			ancestorHash: localHash,
			localMtime: mtime,
			remoteMtime: mtime,
			syncStatus: "synced",
			lastSyncedAt: now,
			serverVersionId: responseBody.snapshot_id ?? null,
		})
	}

	private markConflict(filePath: string): void {
		const state = this.db.getSyncState(filePath)
		if (state) {
			this.db.upsertSyncState({ ...state, syncStatus: "conflict" })
		}
		this.onEvent("sync-conflict", { path: filePath })
	}

	private emitFileEvent(path: string, status: string): void {
		this.onEvent("sync-file-event", { path, status })
	}

	private emitLog(level: string, message: string): void {
		this.onEvent("sync-log", { level, message })
	}

	private emitProgress(total: number, completed: number, phase: string): void {
		this.onEvent("sync-initial-progress", { total, completed, phase } satisfies InitialSyncProgress)
	}
}

export function computeInitialActions(
	remoteFiles: RemoteFileInfo[],
	localStates: SyncStateRow[],
	localDisk: Map<string, LocalFileInfo>,
	syncPreferences: SyncPreferences,
): InitialSyncAction[] {
	const actions: InitialSyncAction[] = []
	const stateMap = new Map(localStates.map((state) => [state.filePath, state]))
	const remoteMap = new Map(remoteFiles.map((file) => [file.file_path, file]))

	for (const remote of remoteFiles) {
		if (remote.deleted) {
			if (localDisk.has(remote.file_path)) {
				if (stateMap.has(remote.file_path)) {
					actions.push({ type: "delete", path: remote.file_path })
				} else {
					actions.push({ type: "upload", path: remote.file_path })
				}
			}
			continue
		}
		if (shouldIgnorePath(remote.file_path, syncPreferences)) continue

		const local = localDisk.get(remote.file_path)
		const dbState = stateMap.get(remote.file_path)
		if (!local) {
			actions.push({
				type: "download",
				path: remote.file_path,
				version: remote.version ?? 1,
			})
			continue
		}

		const remoteChecksum = remote.checksum ?? ""
		if (local.hash === remoteChecksum) continue

		if (dbState) {
			const ancestor = dbState.ancestorHash
			const localChanged = ancestor == null || ancestor !== local.hash
			const remoteChanged = ancestor == null || ancestor !== remoteChecksum
			if (localChanged && remoteChanged) {
				actions.push({ type: "conflict", path: remote.file_path })
			} else if (remoteChanged) {
				actions.push({
					type: "download",
					path: remote.file_path,
					version: remote.version ?? 1,
				})
			} else {
				actions.push({ type: "upload", path: remote.file_path })
			}
		} else {
			actions.push({
				type: "download",
				path: remote.file_path,
				version: remote.version ?? 1,
			})
		}
	}

	for (const path of localDisk.keys()) {
		if (!remoteMap.has(path) && !shouldIgnorePath(path, syncPreferences)) {
			actions.push({ type: "upload", path })
		}
	}

	const priority = (action: InitialSyncAction): number => {
		switch (action.type) {
			case "download":
				return 0
			case "conflict":
				return 1
			case "delete":
				return 2
			case "upload":
				return 3
		}
	}
	actions.sort((left, right) => priority(left) - priority(right))
	return actions
}
