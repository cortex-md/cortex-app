import type {
	CollabFileSyncRole,
	ConflictResolution,
	DeletedFileInfo,
	VersionInfo,
} from "@cortex/platform"
import { hashBytes } from "@cortex/platform/hash"
import * as syncApi from "@cortex/sync-api"
import { SyncError } from "@cortex/sync-api"
import type { SyncAccess } from "./access"
import { utf8Decode, utf8Encode } from "./bytes"
import { attemptAutoMerge } from "./conflict"
import { decrypt, encrypt } from "./crypto"
import type { FileState, NoteMetadataRecord, SyncDb } from "./db"
import { isMergeableText, takeConflictSide } from "./merge"
import { isNotFoundError, syncRuntime } from "./runtime"
import { resolveInVault, writeFileAtomic } from "./util"

export interface SyncContext {
	api: syncApi.ApiClient
	db: SyncDb
	vaultId: string
	vaultPath: string
	vek: Uint8Array
	access: SyncAccess
	collabRoles?: ReadonlyMap<string, CollabFileSyncRole>
}

export type SyncOutcome =
	| "unchanged"
	| "pushed"
	| "pulled"
	| "merged"
	| "conflict"
	| "deferred"
	| "deleted"
	| "restored"
	| "kept-live"

export interface RemoteContent {
	content: Uint8Array
	hash: string
	version: number
}

interface FileStat {
	mtime: number
	size: number
}

interface LocalContent {
	content: Uint8Array
	hash: string
	stat?: FileStat
}

interface SyncBase {
	version: number | null
	hash: string | null
}

const MAX_PUSH_ATTEMPTS = 5
const NEW_FILE_BASE: SyncBase = { version: 0, hash: null }

function baseFor(state: FileState | null): SyncBase {
	return state ? { version: state.serverVersion, hash: state.ancestorHash } : NEW_FILE_BASE
}

export function collabRole(ctx: SyncContext, path: string): CollabFileSyncRole | null {
	return ctx.collabRoles?.get(path) ?? null
}

function hasStatus(error: unknown, status: number): boolean {
	return error instanceof SyncError && error.status === status
}

function writeMetadata(result: syncApi.UploadResult): NoteMetadataRecord {
	return {
		createdAt: result.createdAt,
		createdBy: result.createdBy,
		lastEditedAt: result.updatedAt,
		lastEditedBy: result.lastModifiedBy,
		lastDeviceId: result.lastDeviceId,
	}
}

async function localStat(ctx: SyncContext, path: string): Promise<FileStat | null> {
	try {
		const stats = await syncRuntime().fs.lstat(resolveInVault(ctx.vaultPath, path))
		return stats.isFile() ? { mtime: Math.trunc(stats.mtimeMs), size: stats.size } : null
	} catch {
		return null
	}
}

async function storeState(
	ctx: SyncContext,
	path: string,
	state: Omit<FileState, "filePath" | "localMtime" | "localSize">,
	knownStat?: FileStat,
): Promise<void> {
	const stat = knownStat ?? (await localStat(ctx, path))
	ctx.db.upsertFileState({
		...state,
		filePath: path,
		localMtime: stat?.mtime ?? null,
		localSize: stat?.size ?? null,
	})
}

async function markSynced(
	ctx: SyncContext,
	path: string,
	hash: string,
	serverVersion: number,
	stat?: FileStat,
): Promise<void> {
	await storeState(
		ctx,
		path,
		{ localHash: hash, remoteHash: hash, ancestorHash: hash, syncStatus: "synced", serverVersion },
		stat,
	)
}

async function markConflict(
	ctx: SyncContext,
	path: string,
	conflictHash: string,
	remote: RemoteContent,
): Promise<void> {
	await storeState(ctx, path, {
		localHash: conflictHash,
		remoteHash: remote.hash,
		ancestorHash: remote.hash,
		syncStatus: "conflict",
		serverVersion: remote.version,
	})
}

async function writeLocal(ctx: SyncContext, path: string, content: Uint8Array): Promise<void> {
	await writeFileAtomic(resolveInVault(ctx.vaultPath, path), content)
}

async function readLocal(ctx: SyncContext, path: string): Promise<LocalContent | null> {
	const stat = await localStat(ctx, path)
	if (!stat) return null
	try {
		const content = await syncRuntime().fs.readFile(resolveInVault(ctx.vaultPath, path))
		return { content, hash: hashBytes(content), stat }
	} catch (error) {
		if (isNotFoundError(error)) return null
		throw error
	}
}

async function replaceLocal(
	ctx: SyncContext,
	path: string,
	expectedHash: string,
	content: Uint8Array,
): Promise<boolean> {
	if ((await readLocal(ctx, path))?.hash !== expectedHash) return false
	await writeLocal(ctx, path, content)
	return true
}

async function fetchDecrypted(
	ctx: SyncContext,
	path: string,
	version: number | null = null,
): Promise<{ content: Uint8Array; version: number }> {
	const downloaded = await syncApi.downloadFile(ctx.api, ctx.vaultId, path, version)
	return { content: decrypt(downloaded.bytes, ctx.vek), version: downloaded.version }
}

export function remoteContent(content: Uint8Array, version: number): RemoteContent {
	return { content, hash: hashBytes(content), version }
}

async function fetchRemote(ctx: SyncContext, path: string): Promise<RemoteContent> {
	const { content, version } = await fetchDecrypted(ctx, path)
	return remoteContent(content, version)
}

async function loadAncestor(
	ctx: SyncContext,
	path: string,
	base: SyncBase,
): Promise<Uint8Array | null> {
	if (!base.hash || !base.version) return null
	try {
		const { content } = await fetchDecrypted(ctx, path, base.version)
		return hashBytes(content) === base.hash ? content : null
	} catch (error) {
		if (hasStatus(error, 404)) return null
		throw error
	}
}

async function pushContent(
	ctx: SyncContext,
	path: string,
	local: LocalContent,
	base: SyncBase,
	attempt = 0,
): Promise<SyncOutcome> {
	if (attempt >= MAX_PUSH_ATTEMPTS) {
		throw new SyncError("transient", `Upload ${path} failed: remote kept changing`)
	}
	try {
		const result = await syncApi.uploadFile(
			ctx.api,
			ctx.vaultId,
			path,
			local.hash,
			encrypt(local.content, ctx.vek),
			base.version,
		)
		await markSynced(ctx, path, local.hash, result.version, local.stat)
		ctx.db.upsertNoteMetadata(path, writeMetadata(result))
		return "pushed"
	} catch (error) {
		if (!syncApi.isVersionConflict(error)) throw error
	}

	const info = await syncApi.fileInfo(ctx.api, ctx.vaultId, path)
	if (!info || info.deleted) {
		return await pushContent(
			ctx,
			path,
			local,
			{ version: info?.version ?? null, hash: null },
			attempt + 1,
		)
	}
	if (info.checksum === local.hash) {
		await markSynced(ctx, path, local.hash, info.version, local.stat)
		return "pushed"
	}
	if (base.hash && info.checksum === base.hash) {
		return await pushContent(
			ctx,
			path,
			local,
			{ version: info.version, hash: base.hash },
			attempt + 1,
		)
	}
	const remote = await fetchRemote(ctx, path)
	return await mergeWithRemote(ctx, path, local, remote, base, attempt + 1)
}

async function mergeWithRemote(
	ctx: SyncContext,
	path: string,
	local: LocalContent,
	remote: RemoteContent,
	base: SyncBase,
	attempt = 0,
): Promise<SyncOutcome> {
	const attempted = await attemptAutoMerge(path, local.content, remote.content, () =>
		loadAncestor(ctx, path, base),
	)
	const keepLive = attempted.kind === "conflict" && collabRole(ctx, path) === "leader"
	const merge = keepLive
		? {
				kind: "merged" as const,
				content: utf8Encode(takeConflictSide(utf8Decode(attempted.content), "local")),
			}
		: attempted
	const mergedHash = hashBytes(merge.content)
	if (mergedHash !== local.hash && !(await replaceLocal(ctx, path, local.hash, merge.content))) {
		return "deferred"
	}
	if (merge.kind === "conflict") {
		await markConflict(ctx, path, mergedHash, remote)
		return "conflict"
	}
	if (mergedHash === remote.hash) {
		await markSynced(
			ctx,
			path,
			remote.hash,
			remote.version,
			mergedHash === local.hash ? local.stat : undefined,
		)
		return "pulled"
	}
	const outcome = await pushContent(
		ctx,
		path,
		{ content: merge.content, hash: mergedHash },
		{ version: remote.version, hash: remote.hash },
		attempt,
	)
	if (outcome !== "pushed") return outcome
	if (keepLive) return "kept-live"
	return mergedHash !== local.hash ? "merged" : outcome
}

function adoptRemoteState(ctx: SyncContext, path: string, hash: string, version: number): void {
	const state = ctx.db.getFileState(path)
	ctx.db.upsertFileState({
		filePath: path,
		localHash: state?.localHash ?? null,
		remoteHash: hash,
		ancestorHash: hash,
		localMtime: state?.localMtime ?? null,
		localSize: state?.localSize ?? null,
		syncStatus: state?.syncStatus ?? "synced",
		serverVersion: version,
	})
}

export async function adoptRemoteVersion(ctx: SyncContext, path: string): Promise<SyncOutcome> {
	const info = await syncApi.fileInfo(ctx.api, ctx.vaultId, path)
	if (info && !info.deleted && info.checksum)
		adoptRemoteState(ctx, path, info.checksum, info.version)
	return "unchanged"
}

export async function settleOrUpload(ctx: SyncContext, path: string): Promise<SyncOutcome> {
	const state = ctx.db.getFileState(path)
	if (state?.syncStatus === "conflict") return "unchanged"
	const [local, info] = await Promise.all([
		readLocal(ctx, path),
		syncApi.fileInfo(ctx.api, ctx.vaultId, path),
	])
	const remote = info && !info.deleted ? info : null
	if (!local) {
		if (!state) return "unchanged"
		if (!remote) {
			ctx.db.deleteFileState(path)
			return "deleted"
		}
		if (!ctx.access.canWrite(path)) {
			return await applyRemoteContent(ctx, path, await fetchRemote(ctx, path))
		}
		return await deleteRemoteFile(ctx, path)
	}
	if (remote && remote.checksum === local.hash) {
		await markSynced(ctx, path, local.hash, remote.version, local.stat)
		return "unchanged"
	}
	const unchangedLocally = state !== null && local.hash === state.localHash
	if (remote && (unchangedLocally || !ctx.access.canWrite(path))) {
		return await applyRemoteContent(ctx, path, await fetchRemote(ctx, path))
	}
	if (!ctx.access.canWrite(path)) return "unchanged"
	return await pushContent(ctx, path, local, baseFor(state))
}

export async function applyRemoteContent(
	ctx: SyncContext,
	path: string,
	remote: RemoteContent,
): Promise<SyncOutcome> {
	if (collabRole(ctx, path) === "follower") {
		adoptRemoteState(ctx, path, remote.hash, remote.version)
		return "unchanged"
	}
	const state = ctx.db.getFileState(path)
	if (state?.syncStatus === "conflict") return "unchanged"
	const local = await readLocal(ctx, path)
	if (local?.hash === remote.hash) {
		await markSynced(ctx, path, remote.hash, remote.version, local.stat)
		return "pulled"
	}
	if (!local || (state && local.hash === state.localHash)) {
		await writeLocal(ctx, path, remote.content)
		await markSynced(ctx, path, remote.hash, remote.version)
		return "pulled"
	}
	if (!ctx.access.canWrite(path)) {
		await writeLocal(ctx, path, remote.content)
		await markSynced(ctx, path, remote.hash, remote.version)
		return "restored"
	}
	if (state && remote.hash === state.ancestorHash) return "unchanged"
	return await mergeWithRemote(ctx, path, local, remote, baseFor(state))
}

export function needsDownload(ctx: SyncContext, path: string, knownVersion: number): boolean {
	const state = ctx.db.getFileState(path)
	if (!state) return true
	if (state.syncStatus === "conflict") return false
	return state.serverVersion === null || state.serverVersion < knownVersion
}

export async function downloadFile(
	ctx: SyncContext,
	path: string,
	knownVersion: number,
): Promise<SyncOutcome> {
	if (!needsDownload(ctx, path, knownVersion)) return "unchanged"
	return await applyRemoteContent(ctx, path, await fetchRemote(ctx, path))
}

export async function restoreRemoteFile(ctx: SyncContext, path: string): Promise<SyncOutcome> {
	const state = ctx.db.getFileState(path)
	if (!state || state.syncStatus === "conflict") return "unchanged"
	const local = await readLocal(ctx, path)
	if (local?.hash === state.localHash) return "unchanged"
	return await applyRemoteContent(ctx, path, await fetchRemote(ctx, path))
}

export async function uploadFile(ctx: SyncContext, path: string): Promise<SyncOutcome> {
	const state = ctx.db.getFileState(path)
	if (state?.syncStatus === "conflict") return "unchanged"
	const local = await readLocal(ctx, path)
	if (!local || state?.localHash === local.hash) return "unchanged"
	return await pushContent(ctx, path, local, baseFor(state))
}

export async function deleteRemoteFile(ctx: SyncContext, path: string): Promise<SyncOutcome> {
	const baseVersion = ctx.db.getFileState(path)?.serverVersion ?? null
	try {
		await syncApi.deleteFile(ctx.api, ctx.vaultId, path, baseVersion)
	} catch (error) {
		if (!syncApi.isVersionConflict(error)) throw error
		const remote = await fetchRemote(ctx, path)
		await writeLocal(ctx, path, remote.content)
		await markSynced(ctx, path, remote.hash, remote.version)
		return "pulled"
	}
	ctx.db.deleteFileState(path)
	return "deleted"
}

function assertReadable(ctx: SyncContext, path: string): void {
	if (!ctx.access.canRead(path)) throw new SyncError("forbidden", `${path}: you don't have access`)
}

function assertWritable(ctx: SyncContext, path: string): void {
	if (!ctx.access.canWrite(path)) throw new SyncError("forbidden", `${path} is read-only for you`)
}

export async function renameRemoteFile(
	ctx: SyncContext,
	oldPath: string,
	newPath: string,
): Promise<SyncOutcome> {
	assertWritable(ctx, oldPath)
	assertWritable(ctx, newPath)
	let result: syncApi.UploadResult
	try {
		result = await syncApi.renameFile(ctx.api, ctx.vaultId, oldPath, newPath)
	} catch (error) {
		if (hasStatus(error, 404)) return await uploadFile(ctx, newPath)
		if (!hasStatus(error, 409)) throw error
		const outcome = await uploadFile(ctx, newPath)
		await deleteRemoteFile(ctx, oldPath)
		return outcome
	}
	ctx.db.renamePath(oldPath, newPath)
	const state = ctx.db.getFileState(newPath)
	if (state) ctx.db.upsertFileState({ ...state, serverVersion: result.version })
	ctx.db.upsertNoteMetadata(newPath, writeMetadata(result))
	return "pushed"
}

export async function applyResolution(
	ctx: SyncContext,
	path: string,
	resolution: ConflictResolution,
): Promise<SyncOutcome> {
	if (resolution.type === "keep_remote") assertReadable(ctx, path)
	else assertWritable(ctx, path)
	const state = ctx.db.getFileState(path)
	if (resolution.type === "keep_remote") {
		const remote = await fetchRemote(ctx, path)
		await writeLocal(ctx, path, remote.content)
		await markSynced(ctx, path, remote.hash, remote.version)
		return "pulled"
	}
	const current = await readLocal(ctx, path)
	let content = current?.content ?? new Uint8Array(0)
	if (resolution.type === "merged") content = utf8Encode(resolution.content)
	else if (isMergeableText(path))
		content = utf8Encode(takeConflictSide(utf8Decode(content), "local"))
	const hash = hashBytes(content)
	if (hash === current?.hash) return await pushContent(ctx, path, current, baseFor(state))
	await writeLocal(ctx, path, content)
	return await pushContent(ctx, path, { content, hash }, baseFor(state))
}

export async function deleteLocalFile(ctx: SyncContext, path: string): Promise<SyncOutcome> {
	const state = ctx.db.getFileState(path)
	if (state?.syncStatus === "conflict") return "unchanged"
	const local = await readLocal(ctx, path)
	if (local) {
		if (local.hash !== state?.localHash) {
			if (ctx.access.canWrite(path)) return await pushContent(ctx, path, local, baseFor(state))
			ctx.db.deleteFileState(path)
			return "deferred"
		}
		await syncRuntime().fs.rm(resolveInVault(ctx.vaultPath, path))
	}
	ctx.db.deleteFileState(path)
	return "deleted"
}

export async function renameLocalFile(
	ctx: SyncContext,
	oldPath: string,
	newPath: string,
): Promise<SyncOutcome> {
	const oldFull = resolveInVault(ctx.vaultPath, oldPath)
	const newFull = resolveInVault(ctx.vaultPath, newPath)
	await syncRuntime().fs.mkdir(syncRuntime().path.dirname(newFull))
	try {
		await syncRuntime().fs.rename(oldFull, newFull)
	} catch (error) {
		if (!isNotFoundError(error)) throw error
		ctx.db.deleteFileState(oldPath)
		return await applyRemoteContent(ctx, newPath, await fetchRemote(ctx, newPath))
	}
	ctx.db.renamePath(oldPath, newPath)
	return "pulled"
}

export async function getVersionHistory(ctx: SyncContext, path: string): Promise<VersionInfo[]> {
	assertReadable(ctx, path)
	return await syncApi.fileHistory(ctx.api, ctx.vaultId, path)
}

export async function downloadVersion(
	ctx: SyncContext,
	path: string,
	version: number,
): Promise<Uint8Array> {
	assertReadable(ctx, path)
	return (await fetchDecrypted(ctx, path, version)).content
}

export async function restoreVersion(
	ctx: SyncContext,
	path: string,
	version: number,
): Promise<void> {
	assertWritable(ctx, path)
	const content = await downloadVersion(ctx, path, version)
	await writeLocal(ctx, path, content)
	const state = ctx.db.getFileState(path)
	await pushContent(ctx, path, { content, hash: hashBytes(content) }, baseFor(state))
}

export async function listDeletedFiles(ctx: SyncContext): Promise<DeletedFileInfo[]> {
	return await syncApi.listDeletedFiles(ctx.api, ctx.vaultId)
}

export async function restoreDeletedFile(ctx: SyncContext, path: string): Promise<void> {
	assertWritable(ctx, path)
	await syncApi.restoreFile(ctx.api, ctx.vaultId, path)
	const remote = await fetchRemote(ctx, path)
	await writeLocal(ctx, path, remote.content)
	await markSynced(ctx, path, remote.hash, remote.version)
}

export function settleFileState(
	ctx: SyncContext,
	path: string,
	hash: string,
	version: number,
	stat: { mtime: number; size: number },
): void {
	ctx.db.upsertFileState({
		filePath: path,
		localHash: hash,
		remoteHash: hash,
		ancestorHash: hash,
		localMtime: stat.mtime,
		localSize: stat.size,
		syncStatus: "synced",
		serverVersion: version,
	})
}
