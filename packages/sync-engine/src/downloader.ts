import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from "node:fs"
import { dirname, join } from "node:path"
import { type AutoMergeResult, ConflictResolver, DetectResult, detect } from "./conflict"
import { decrypt } from "./crypto"
import type { SyncDb, SyncStateRow } from "./db"
import { atomicWriteBytes } from "./fsAtomic"
import { hashContent } from "./hash"
import type { SyncHttpClient } from "./http"
import { urlencoded } from "./url"

export type DownloadResult =
	| { kind: "synced" }
	| { kind: "merged" }
	| { kind: "conflict"; localText: string; remoteText: string }

export interface VersionInfo {
	snapshotId: string
	version: number
	sizeBytes?: number | null
	checksum?: string | null
	authorId?: string | null
	authorName?: string | null
	deviceId?: string | null
	deviceName?: string | null
	createdAt?: string | null
}

export interface DeletedFileInfo {
	filePath: string
	version: number
	sizeBytes?: number | null
	checksum?: string | null
	contentType?: string | null
	deletedAt?: string | null
	lastModifiedBy?: string | null
	lastDeviceId?: string | null
}

export class Downloader {
	constructor(
		private readonly client: SyncHttpClient,
		private readonly db: SyncDb,
		private readonly vaultId: string,
		private readonly vaultPath: string,
		private readonly vek: Buffer,
	) {}

	async downloadFile(filePath: string): Promise<DownloadResult> {
		const apiPath = `/sync/v1/vaults/${this.vaultId}/files?path=${urlencoded(filePath)}`
		const response = await this.client.get(apiPath)
		if (!response.ok) {
			const body = await response.text()
			throw new Error(`Download failed: HTTP ${response.status}: ${body}`)
		}

		const snapshotId = response.headers.get("X-Snapshot-ID")
		const encrypted = await response.bytes()
		const plaintext = decrypt(encrypted, this.vek)
		const remoteHash = hashContent(plaintext)
		const fullPath = join(this.vaultPath, filePath)
		const existingState = this.db.getSyncState(filePath)

		if (existsSync(fullPath) && existingState) {
			const localContent = readFileSync(fullPath)
			const localHash = hashContent(localContent)

			if (localHash === remoteHash) {
				this.updateStateSynced(filePath, remoteHash, snapshotId)
				return { kind: "synced" }
			}

			const detection = detect(localHash, remoteHash, existingState.ancestorHash)
			if (detection === DetectResult.Conflict) {
				const resolver = new ConflictResolver(
					this.client,
					this.db,
					this.vaultId,
					this.vaultPath,
					this.vek,
				)
				const merge = await resolver.attemptAutoMerge(
					filePath,
					localContent,
					plaintext,
					existingState,
				)
				return await this.applyAutoMerge(
					filePath,
					remoteHash,
					snapshotId,
					localHash,
					existingState,
					merge,
				)
			}
			if (detection === DetectResult.LocalOnly) {
				return { kind: "synced" }
			}
		}

		await this.writeAndUpdate(filePath, plaintext, remoteHash, snapshotId)
		return { kind: "synced" }
	}

	private async applyAutoMerge(
		filePath: string,
		remoteHash: string,
		snapshotId: string | null,
		localHash: string,
		state: SyncStateRow,
		merge: AutoMergeResult,
	): Promise<DownloadResult> {
		const fullPath = join(this.vaultPath, filePath)
		switch (merge.kind) {
			case "keepLocal":
				return { kind: "synced" }
			case "keepRemote":
				await this.writeAndUpdate(filePath, merge.content, remoteHash, snapshotId)
				return { kind: "synced" }
			case "merged": {
				const mergedHash = hashContent(merge.content)
				await this.writeAndUpdate(filePath, merge.content, mergedHash, snapshotId)
				return { kind: "merged" }
			}
			case "needsManualResolution": {
				await atomicWriteBytes(fullPath, Buffer.from(merge.conflictText, "utf8"))
				const now = Math.floor(Date.now() / 1000)
				this.db.upsertSyncState({
					filePath,
					localHash,
					remoteHash,
					ancestorHash: state.ancestorHash,
					localMtime: now,
					remoteMtime: now,
					syncStatus: "conflict",
					lastSyncedAt: state.lastSyncedAt,
					serverVersionId: snapshotId,
				})
				return {
					kind: "conflict",
					localText: merge.localText,
					remoteText: merge.remoteText,
				}
			}
		}
	}

	async downloadVersion(filePath: string, version: string): Promise<Buffer> {
		const apiPath = `/sync/v1/vaults/${this.vaultId}/files?path=${urlencoded(filePath)}&version=${version}`
		const response = await this.client.get(apiPath)
		if (!response.ok) {
			const body = await response.text()
			throw new Error(`Download version failed: ${body}`)
		}
		const encrypted = await response.bytes()
		return decrypt(encrypted, this.vek)
	}

	async getVersionHistory(filePath: string): Promise<VersionInfo[]> {
		const apiPath = `/sync/v1/vaults/${this.vaultId}/files/history?path=${urlencoded(filePath)}`
		const response = await this.client.get(apiPath)
		if (!response.ok) {
			const body = await response.text()
			throw new Error(`Version history failed with HTTP ${response.status}: ${body}`)
		}
		const versions =
			await response.json<
				Array<{
					snapshot_id: string
					version: number
					size_bytes?: number | null
					checksum?: string | null
					author_id?: string | null
					created_by?: string | null
					author_name?: string | null
					device_id?: string | null
					device_name?: string | null
					created_at?: string | null
				}>
			>()
		return versions.map((version) => ({
			snapshotId: version.snapshot_id,
			version: version.version,
			sizeBytes: version.size_bytes ?? null,
			checksum: version.checksum ?? null,
			authorId: version.author_id ?? version.created_by ?? null,
			authorName: version.author_name ?? null,
			deviceId: version.device_id ?? null,
			deviceName: version.device_name ?? null,
			createdAt: version.created_at ?? null,
		}))
	}

	async deleteLocalFile(filePath: string): Promise<void> {
		const fullPath = join(this.vaultPath, filePath)
		if (existsSync(fullPath)) unlinkSync(fullPath)
		this.db.deleteSyncState(filePath)
	}

	async listDeletedFiles(): Promise<DeletedFileInfo[]> {
		const apiPath = `/sync/v1/vaults/${this.vaultId}/files/list?include_deleted=true`
		const response = await this.client.get(apiPath)
		if (!response.ok) {
			const body = await response.text()
			throw new Error(`List files failed: ${body}`)
		}
		const entries =
			await response.json<
				Array<{
					file_path: string
					version?: number | null
					size_bytes?: number | null
					checksum?: string | null
					content_type?: string | null
					deleted?: boolean | null
					updated_at?: string | null
					last_modified_by?: string | null
					last_device_id?: string | null
				}>
			>()
		return entries
			.filter((entry) => entry.deleted)
			.map((entry) => ({
				filePath: entry.file_path,
				version: entry.version ?? 0,
				sizeBytes: entry.size_bytes ?? null,
				checksum: entry.checksum ?? null,
				contentType: entry.content_type ?? null,
				deletedAt: entry.updated_at ?? null,
				lastModifiedBy: entry.last_modified_by ?? null,
				lastDeviceId: entry.last_device_id ?? null,
			}))
	}

	async restoreDeletedFile(filePath: string): Promise<void> {
		const apiPath = `/sync/v1/vaults/${this.vaultId}/files/restore?path=${urlencoded(filePath)}`
		const response = await this.client.postJson(apiPath, {})
		if (!response.ok) {
			const body = await response.text()
			throw new Error(`Restore file failed: ${body}`)
		}
		const content = await this.downloadVersion(filePath, "0")
		await atomicWriteBytes(join(this.vaultPath, filePath), content)
		const hash = hashContent(content)
		const now = Math.floor(Date.now() / 1000)
		this.db.upsertSyncState({
			filePath,
			localHash: hash,
			remoteHash: hash,
			ancestorHash: hash,
			localMtime: now,
			remoteMtime: now,
			syncStatus: "synced",
			lastSyncedAt: now,
			serverVersionId: null,
		})
	}

	async renameLocalFile(oldPath: string, newPath: string): Promise<void> {
		const oldFull = join(this.vaultPath, oldPath)
		const newFull = join(this.vaultPath, newPath)
		mkdirSync(dirname(newFull), { recursive: true })
		if (existsSync(oldFull)) renameSync(oldFull, newFull)

		const state = this.db.getSyncState(oldPath)
		if (state) {
			this.db.deleteSyncState(oldPath)
			this.db.upsertSyncState({ ...state, filePath: newPath })
		}
		this.db.renameNoteMetadata(oldPath, newPath)
	}

	private async writeAndUpdate(
		filePath: string,
		content: Buffer,
		hash: string,
		snapshotId: string | null,
	): Promise<void> {
		await atomicWriteBytes(join(this.vaultPath, filePath), content)
		this.updateStateSynced(filePath, hash, snapshotId)
	}

	private updateStateSynced(filePath: string, hash: string, snapshotId: string | null): void {
		const now = Math.floor(Date.now() / 1000)
		this.db.upsertSyncState({
			filePath,
			localHash: hash,
			remoteHash: hash,
			ancestorHash: hash,
			localMtime: now,
			remoteMtime: now,
			syncStatus: "synced",
			lastSyncedAt: now,
			serverVersionId: snapshotId,
		})
	}
}
