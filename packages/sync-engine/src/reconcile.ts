import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import type { SyncDb, SyncStateRow } from "./db"
import { Downloader } from "./downloader"
import { hashContent } from "./hash"
import type { SyncHttpClient } from "./http"
import { type SyncPreferences, shouldIgnorePath } from "./ignore"
import type { SyncEventEmitter } from "./initial"
import { normalizeRelativePath } from "./paths"
import { Uploader } from "./uploader"

const LONG_OFFLINE_THRESHOLD_SECS = 30 * 24 * 60 * 60

interface ChangeEvent {
	id: number
	vault_id?: string
	event_type: string
	file_path: string
	version?: number | null
	actor_id: string
	device_id: string
	metadata?: { old_path?: string } | null
	created_at: string
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
	size: number
}

type ReconcileAction =
	| { type: "download"; path: string }
	| { type: "upload"; path: string }
	| { type: "delete"; path: string }
	| { type: "rename"; oldPath: string; newPath: string }

export class Reconciler {
	constructor(
		private readonly onEvent: SyncEventEmitter,
		private readonly client: SyncHttpClient,
		private readonly db: SyncDb,
		private readonly vaultId: string,
		private readonly vaultPath: string,
		private readonly vek: Buffer,
		private readonly ownDeviceId: string,
		private readonly syncPreferences: SyncPreferences,
	) {}

	async run(lastEventId: string | null): Promise<string | null> {
		if (lastEventId && this.isShortGap(lastEventId)) {
			return await this.incrementalReconcile(lastEventId)
		}
		return await this.fullReconcile()
	}

	private isShortGap(lastEventId: string): boolean {
		if (!lastEventId) return false
		const lastSyncTs = Number(this.db.getMetadata("last_reconcile_at") ?? "0")
		const now = Math.floor(Date.now() / 1000)
		return now - lastSyncTs < LONG_OFFLINE_THRESHOLD_SECS
	}

	private async incrementalReconcile(lastEventId: string): Promise<string | null> {
		let since = lastEventId
		let latestEventId: string | null = lastEventId
		const limit = 100

		while (true) {
			const apiPath = `/sync/v1/vaults/${this.vaultId}/changes?since=${since}&limit=${limit}`
			const response = await this.client.get(apiPath)
			if (!response.ok) {
				const body = await response.text()
				throw new Error(`Changes endpoint failed: HTTP ${response.status}: ${body}`)
			}
			const events = await response.json<ChangeEvent[]>()
			if (events.length === 0) break

			for (const event of events) {
				if (event.event_type === "file_deleted") continue
				this.db.upsertNoteMetadata(event.file_path, {
					createdAt: event.event_type === "file_created" ? event.created_at : null,
					createdBy: event.event_type === "file_created" ? event.actor_id : null,
					lastEditedAt: event.created_at,
					lastEditedBy: event.actor_id,
					lastDeviceId: event.device_id,
					synced: true,
					creationLookupComplete: event.event_type === "file_created",
				})
			}

			const actions = eventsToActions(events, this.ownDeviceId, this.syncPreferences)
			await this.executeActions(actions)

			const last = events[events.length - 1]
			if (last) {
				since = String(last.id)
				latestEventId = since
			}
			if (events.length < limit) break
		}

		this.saveReconcileTimestamp()
		return latestEventId
	}

	private async fullReconcile(): Promise<string | null> {
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
		const localDisk = this.scanLocalFiles()
		const actions = computeFullReconcileActions(
			remoteFiles,
			localStates,
			localDisk,
			this.syncPreferences,
		)
		await this.executeActions(actions)
		this.saveReconcileTimestamp()
		return await this.fetchLatestEventId()
	}

	private async executeActions(actions: ReconcileAction[]): Promise<void> {
		const downloader = new Downloader(this.client, this.db, this.vaultId, this.vaultPath, this.vek)
		const uploader = new Uploader(this.client, this.db, this.vaultId, this.vaultPath, this.vek)

		for (const action of actions) {
			switch (action.type) {
				case "download": {
					this.emitFileEvent(action.path, "downloading")
					const result = await downloader.downloadFile(action.path)
					if (result.kind === "synced") {
						this.emitLog("info", `Pulled: ${action.path}`)
						this.emitFileEvent(action.path, "synced")
					} else if (result.kind === "merged") {
						this.emitLog("info", `Merged: ${action.path}`)
						this.emitFileEvent(action.path, "merged")
					} else {
						this.emitFileEvent(action.path, "conflict")
						this.onEvent("sync-conflict", { path: action.path })
					}
					break
				}
				case "upload":
					this.emitFileEvent(action.path, "uploading")
					await uploader.uploadFile(action.path)
					this.emitLog("info", `Pushed: ${action.path}`)
					this.emitFileEvent(action.path, "synced")
					break
				case "delete": {
					this.emitFileEvent(action.path, "deleting")
					const fullPath = join(this.vaultPath, action.path)
					if (existsSync(fullPath)) unlinkSync(fullPath)
					this.db.deleteSyncState(action.path)
					this.emitLog("info", `Deleted locally: ${action.path}`)
					this.emitFileEvent(action.path, "deleted")
					break
				}
				case "rename":
					this.emitFileEvent(action.oldPath, "renaming")
					await downloader.renameLocalFile(action.oldPath, action.newPath)
					this.emitFileEvent(action.newPath, "synced")
					break
			}
		}
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
			files.set(relative, { hash: hashContent(content), size: content.length })
		}
	}

	private async fetchLatestEventId(): Promise<string | null> {
		const response = await this.client.get(`/sync/v1/vaults/${this.vaultId}/changes?limit=1`)
		if (!response.ok) return null
		const events = await response.json<ChangeEvent[]>()
		const last = events[events.length - 1]
		return last ? String(last.id) : null
	}

	private saveReconcileTimestamp(): void {
		this.db.setMetadata("last_reconcile_at", String(Math.floor(Date.now() / 1000)))
	}

	private emitFileEvent(path: string, status: string): void {
		this.onEvent("sync-file-event", { path, status })
	}

	private emitLog(level: string, message: string): void {
		this.onEvent("sync-log", { level, message })
	}
}

export function eventsToActions(
	events: ChangeEvent[],
	ownDeviceId: string,
	syncPreferences: SyncPreferences,
): ReconcileAction[] {
	const actions: ReconcileAction[] = []
	const seenPaths = new Map<string, number>()

	for (const event of events) {
		if (event.device_id === ownDeviceId) continue
		if (shouldIgnorePath(event.file_path, syncPreferences)) continue

		let action: ReconcileAction | null = null
		switch (event.event_type) {
			case "file_created":
			case "file_updated":
				action = { type: "download", path: event.file_path }
				break
			case "file_deleted":
				action = { type: "delete", path: event.file_path }
				break
			case "file_renamed": {
				const oldPath = event.metadata?.old_path ?? ""
				action = oldPath
					? { type: "rename", oldPath, newPath: event.file_path }
					: { type: "download", path: event.file_path }
				break
			}
		}
		if (!action) continue
		const key = action.type === "rename" ? action.newPath : action.path
		const existing = seenPaths.get(key)
		if (existing !== undefined) {
			actions[existing] = action
		} else {
			seenPaths.set(key, actions.length)
			actions.push(action)
		}
	}
	return actions
}

export function computeFullReconcileActions(
	remoteFiles: RemoteFileInfo[],
	localStates: SyncStateRow[],
	localDisk: Map<string, LocalFileInfo>,
	syncPreferences: SyncPreferences,
): ReconcileAction[] {
	const actions: ReconcileAction[] = []
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
			actions.push({ type: "download", path: remote.file_path })
			continue
		}
		const remoteChecksum = remote.checksum ?? ""
		if (local.hash === remoteChecksum) continue

		if (dbState) {
			const ancestor = dbState.ancestorHash
			const localChanged = ancestor == null || ancestor !== local.hash
			const remoteChanged = ancestor == null || ancestor !== remoteChecksum
			if (remoteChanged && !localChanged) {
				actions.push({ type: "download", path: remote.file_path })
			} else if (localChanged && !remoteChanged) {
				actions.push({ type: "upload", path: remote.file_path })
			} else {
				actions.push({ type: "download", path: remote.file_path })
			}
		} else {
			actions.push({ type: "download", path: remote.file_path })
		}
	}

	for (const path of localDisk.keys()) {
		if (!remoteMap.has(path) && !shouldIgnorePath(path, syncPreferences)) {
			if (stateMap.has(path)) {
				actions.push({ type: "delete", path })
			} else {
				actions.push({ type: "upload", path })
			}
		}
	}

	return actions
}
