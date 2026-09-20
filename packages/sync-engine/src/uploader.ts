import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { encrypt } from "./crypto"
import type { NoteSyncMetadata, SyncDb } from "./db"
import { hashContent } from "./hash"
import type { SyncHttpClient } from "./http"
import { urlencoded } from "./url"

export class Uploader {
	constructor(
		private readonly client: SyncHttpClient,
		private readonly db: SyncDb,
		private readonly vaultId: string,
		private readonly vaultPath: string,
		private readonly vek: Buffer,
	) {}

	async uploadFile(filePath: string): Promise<void> {
		const fullPath = join(this.vaultPath, filePath)
		const content = readFileSync(fullPath)
		const localHash = hashContent(content)

		const syncState = this.db.getSyncState(filePath)
		if (syncState?.localHash === localHash) return

		const encrypted = encrypt(content, this.vek)
		const apiPath = `/sync/v1/vaults/${this.vaultId}/files`
		const response = await this.client.postBytes(apiPath, encrypted, [
			["X-File-Path", filePath],
			["X-Local-Hash", localHash],
			["Content-Type", "application/octet-stream"],
		])

		if (!response.ok) {
			const body = await response.text()
			throw new Error(`Upload failed: HTTP ${response.status}: ${body}`)
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

	async deleteRemoteFile(filePath: string): Promise<void> {
		const apiPath = `/sync/v1/vaults/${this.vaultId}/files?path=${urlencoded(filePath)}`
		const response = await this.client.delete(apiPath)
		if (!response.ok && response.status !== 404) {
			const body = await response.text()
			throw new Error(`Delete failed: HTTP ${response.status}: ${body}`)
		}
		this.db.deleteSyncState(filePath)
	}

	async renameRemoteFile(oldPath: string, newPath: string): Promise<void> {
		const apiPath = `/sync/v1/vaults/${this.vaultId}/files/rename`
		const response = await this.client.postJson(apiPath, {
			old_path: oldPath,
			new_path: newPath,
		})
		if (!response.ok) {
			const body = await response.text()
			throw new Error(`Rename failed: HTTP ${response.status}: ${body}`)
		}
		const responseBody = await response.json<{
			created_at?: string
			updated_at?: string
			last_modified_by?: string
			last_device_id?: string
		}>()

		const state = this.db.getSyncState(oldPath)
		if (state) {
			this.db.deleteSyncState(oldPath)
			this.db.upsertSyncState({ ...state, filePath: newPath })
		}
		this.db.renameNoteMetadata(oldPath, newPath)
		this.db.upsertNoteMetadata(newPath, {
			createdAt: responseBody.created_at ?? null,
			createdBy: null,
			lastEditedAt: responseBody.updated_at ?? null,
			lastEditedBy: responseBody.last_modified_by ?? null,
			lastDeviceId: responseBody.last_device_id ?? null,
			synced: true,
			creationLookupComplete: false,
		} satisfies NoteSyncMetadata)
	}
}
