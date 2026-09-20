import { readFileSync } from "node:fs"
import { join } from "node:path"
import { decrypt, encrypt } from "./crypto"
import type { SyncDb, SyncStateRow } from "./db"
import { atomicWriteBytes } from "./fsAtomic"
import { hashContent } from "./hash"
import type { SyncHttpClient } from "./http"
import { isBinary, isJsonConfig, isMarkdown, mergeBinary, mergeJson, mergeMarkdown } from "./merge"
import type { ConflictResolution } from "./state"
import { urlencoded } from "./url"

export interface ConflictInfo {
	filePath: string
	localHash: string
	remoteHash: string
	ancestorHash: string | null
	localContent: string | null
	remoteContent: string | null
}

export enum DetectResult {
	NoConflict = "noConflict",
	LocalOnly = "localOnly",
	RemoteOnly = "remoteOnly",
	Conflict = "conflict",
}

export type AutoMergeResult =
	| { kind: "keepLocal" }
	| { kind: "keepRemote"; content: Buffer }
	| { kind: "merged"; content: Buffer }
	| {
			kind: "needsManualResolution"
			localText: string
			remoteText: string
			conflictText: string
	  }

export function detect(
	localHash: string | null | undefined,
	remoteHash: string | null | undefined,
	ancestorHash: string | null | undefined,
): DetectResult {
	const local = localHash ?? ""
	const remote = remoteHash ?? ""
	const ancestor = ancestorHash ?? ""

	if (local === remote) return DetectResult.NoConflict

	if (!ancestor) {
		if (!local) return DetectResult.RemoteOnly
		if (!remote) return DetectResult.LocalOnly
		return DetectResult.Conflict
	}

	const localChanged = local !== ancestor
	const remoteChanged = remote !== ancestor
	if (!localChanged && !remoteChanged) return DetectResult.NoConflict
	if (localChanged && !remoteChanged) return DetectResult.LocalOnly
	if (!localChanged && remoteChanged) return DetectResult.RemoteOnly
	return DetectResult.Conflict
}

export class ConflictResolver {
	constructor(
		private readonly client: SyncHttpClient,
		private readonly db: SyncDb,
		private readonly vaultId: string,
		private readonly vaultPath: string,
		private readonly vek: Buffer,
	) {}

	async attemptAutoMerge(
		filePath: string,
		localContent: Buffer,
		remoteContent: Buffer,
		syncState: SyncStateRow,
	): Promise<AutoMergeResult> {
		if (isBinary(filePath)) {
			const winner = mergeBinary(syncState.localMtime, syncState.remoteMtime)
			return winner === "local"
				? { kind: "keepLocal" }
				: { kind: "keepRemote", content: remoteContent }
		}

		const localText = localContent.toString("utf8")
		const remoteText = remoteContent.toString("utf8")
		const ancestorText = (await this.fetchAncestor(filePath, syncState).catch(() => "")) ?? ""

		if (isMarkdown(filePath)) {
			const result = mergeMarkdown(ancestorText, localText, remoteText)
			if (result.kind === "clean") {
				return { kind: "merged", content: Buffer.from(result.content, "utf8") }
			}
			return {
				kind: "needsManualResolution",
				localText,
				remoteText,
				conflictText: result.content,
			}
		}

		if (isJsonConfig(filePath)) {
			try {
				const result = mergeJson(ancestorText || "{}", localText, remoteText)
				if (result.kind === "clean") {
					return { kind: "merged", content: Buffer.from(result.content, "utf8") }
				}
			} catch {
				// Fall through to manual resolution.
			}
			return {
				kind: "needsManualResolution",
				localText,
				remoteText,
				conflictText: `<<<<<<< LOCAL\n${localText}\n=======\n${remoteText}\n>>>>>>> REMOTE\n`,
			}
		}

		const winner = mergeBinary(syncState.localMtime, syncState.remoteMtime)
		return winner === "local"
			? { kind: "keepLocal" }
			: { kind: "keepRemote", content: remoteContent }
	}

	async applyResolution(filePath: string, resolution: ConflictResolution): Promise<void> {
		const fullPath = join(this.vaultPath, filePath)
		if (resolution === "keep_local") {
			const content = readFileSync(fullPath)
			const localHash = hashContent(content)
			await this.uploadResolved(filePath, content, localHash)
			return
		}
		if (resolution === "keep_remote") {
			const remoteContent = await this.downloadLatest(filePath)
			const remoteHash = hashContent(remoteContent)
			await atomicWriteBytes(fullPath, remoteContent)
			this.updateSyncStateResolved(filePath, remoteHash)
			return
		}
		const bytes = Buffer.from(resolution.merged.content, "utf8")
		const mergedHash = hashContent(bytes)
		await atomicWriteBytes(fullPath, bytes)
		await this.uploadResolved(filePath, bytes, mergedHash)
	}

	getAllConflicts(): ConflictInfo[] {
		const conflicts: ConflictInfo[] = []
		for (const state of this.db.listAllSyncStates()) {
			if (state.syncStatus !== "conflict") continue
			conflicts.push({
				filePath: state.filePath,
				localHash: state.localHash ?? "",
				remoteHash: state.remoteHash ?? "",
				ancestorHash: state.ancestorHash,
				localContent: this.readLocalText(state.filePath),
				remoteContent: null,
			})
		}
		return conflicts
	}

	private async fetchAncestor(filePath: string, syncState: SyncStateRow): Promise<string> {
		const versionId = syncState.serverVersionId
		if (!versionId) throw new Error("No server version ID for ancestor")
		const apiPath = `/sync/v1/vaults/${this.vaultId}/files?path=${urlencoded(filePath)}&version=${versionId}`
		const response = await this.client.get(apiPath)
		if (!response.ok) throw new Error("Failed to fetch ancestor version")
		const encrypted = await response.bytes()
		return decrypt(encrypted, this.vek).toString("utf8")
	}

	private async downloadLatest(filePath: string): Promise<Buffer> {
		const apiPath = `/sync/v1/vaults/${this.vaultId}/files?path=${urlencoded(filePath)}`
		const response = await this.client.get(apiPath)
		if (!response.ok) {
			const body = await response.text()
			throw new Error(`Download failed: ${body}`)
		}
		const encrypted = await response.bytes()
		return decrypt(encrypted, this.vek)
	}

	private async uploadResolved(filePath: string, content: Buffer, hash: string): Promise<void> {
		const encrypted = encrypt(content, this.vek)
		const apiPath = `/sync/v1/vaults/${this.vaultId}/files`
		const response = await this.client.postBytes(apiPath, encrypted, [
			["X-File-Path", filePath],
			["X-Local-Hash", hash],
			["Content-Type", "application/octet-stream"],
		])
		if (!response.ok) {
			const body = await response.text()
			throw new Error(`Upload resolved failed: ${body}`)
		}
		const responseBody = await response.json<{ snapshot_id?: string }>()
		this.updateSyncStateResolved(filePath, hash, responseBody.snapshot_id ?? null)
	}

	private updateSyncStateResolved(
		filePath: string,
		hash: string,
		snapshotId: string | null = null,
	): void {
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

	private readLocalText(filePath: string): string | null {
		try {
			return readFileSync(join(this.vaultPath, filePath), "utf8")
		} catch {
			return null
		}
	}
}
