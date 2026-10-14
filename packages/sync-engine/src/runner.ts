import type { SyncPreferences } from "@cortex/platform"
import { downloadBatch, listFileIndex, SyncError } from "@cortex/sync-api"
import { decrypt } from "./crypto"
import type { FileState } from "./db"
import {
	type LocalFileInfo,
	type PlannedAction,
	planFullSync,
	remoteFileMetadata,
	scanLocalFiles,
} from "./planner"
import type { EmitSyncEvent } from "./protocol"
import type { SyncOp } from "./queue"
import { syncRuntime } from "./runtime"
import {
	adoptRemoteVersion,
	applyRemoteContent,
	applyResolution,
	collabRole,
	deleteLocalFile,
	deleteRemoteFile,
	downloadFile,
	remoteContent,
	renameLocalFile,
	renameRemoteFile,
	restoreRemoteFile,
	type SyncContext,
	type SyncOutcome,
	settleFileState,
	settleOrUpload,
	uploadFile,
} from "./transfer"
import { accessDenial, errorMessage, isPathForbidden, resolveInVault, runPool } from "./util"

const DOWNLOAD_BATCH_ITEMS = 100
const DOWNLOAD_BATCH_BYTES = 32 * 1024 * 1024
const UPLOAD_CONCURRENCY = 4

export type PlanMode = "initial" | "reconcile"

export function log(emit: EmitSyncEvent, level: "info" | "warn" | "error", message: string): void {
	emit("sync-log", { level, message })
}

export function fileEvent(emit: EmitSyncEvent, path: string, status: string): void {
	emit("sync-file-event", { path, status })
}

const OUTCOME_LOG: Partial<Record<SyncOutcome, string>> = {
	pushed: "Pushed",
	pulled: "Pulled",
	merged: "Merged",
	deleted: "Deleted",
}

export function reportOutcome(emit: EmitSyncEvent, path: string, outcome: SyncOutcome): void {
	if (outcome === "restored") {
		log(emit, "warn", `Discarded local changes to read-only ${path}`)
		fileEvent(emit, path, "synced")
		return
	}
	if (outcome === "kept-live") {
		log(emit, "info", `Merge conflict on ${path}: kept live version`)
		fileEvent(emit, path, "merged")
		return
	}
	if (outcome === "conflict") {
		fileEvent(emit, path, "conflict")
		log(emit, "warn", `Conflict detected: ${path}`)
		emit("sync-conflict", { path })
		return
	}
	const message = OUTCOME_LOG[outcome]
	if (message) log(emit, "info", `${message}: ${path}`)
	fileEvent(emit, path, outcome === "merged" || outcome === "deleted" ? outcome : "synced")
}

const FOLLOWER_SKIPPED_OPS = new Set<SyncOp["type"]>([
	"upload",
	"deleteRemote",
	"delete",
	"restore",
])

export async function executeOp(ctx: SyncContext, op: SyncOp, emit: EmitSyncEvent): Promise<void> {
	if ("path" in op && collabRole(ctx, op.path) === "follower") {
		if (FOLLOWER_SKIPPED_OPS.has(op.type)) return
		if (op.type === "download") {
			reportOutcome(emit, op.path, await adoptRemoteVersion(ctx, op.path))
			return
		}
	}
	switch (op.type) {
		case "upload":
			if (!ctx.access.canWrite(op.path)) {
				reportOutcome(emit, op.path, await restoreRemoteFile(ctx, op.path))
				return
			}
			fileEvent(emit, op.path, "uploading")
			reportOutcome(emit, op.path, await uploadFile(ctx, op.path))
			return
		case "download":
			fileEvent(emit, op.path, "downloading")
			reportOutcome(emit, op.path, await downloadFile(ctx, op.path, op.version))
			return
		case "restore":
			reportOutcome(emit, op.path, await restoreRemoteFile(ctx, op.path))
			return
		case "delete":
			fileEvent(emit, op.path, "deleting")
			reportOutcome(emit, op.path, await deleteLocalFile(ctx, op.path))
			return
		case "deleteRemote":
			fileEvent(emit, op.path, "deleting-remote")
			reportOutcome(emit, op.path, await deleteRemoteFile(ctx, op.path))
			return
		case "rename":
			fileEvent(emit, op.oldPath, "renaming")
			reportOutcome(emit, op.newPath, await renameLocalFile(ctx, op.oldPath, op.newPath))
			return
		case "renameRemote":
			fileEvent(emit, op.oldPath, "renaming-remote")
			reportOutcome(emit, op.newPath, await renameRemoteFile(ctx, op.oldPath, op.newPath))
			return
		case "resolveConflict":
			fileEvent(emit, op.path, "resolving")
			reportOutcome(emit, op.path, await applyResolution(ctx, op.path, op.resolution))
			return
		case "settle":
			reportOutcome(emit, op.path, await settleOrUpload(ctx, op.path))
			return
	}
}

export interface PendingDownload {
	path: string
	version: number
	sizeBytes?: number | null
}

type DownloadSettler = (path: string, error: unknown) => Promise<void> | void

function downloadChunks(downloads: PendingDownload[]): PendingDownload[][] {
	const chunks: PendingDownload[][] = []
	let current: PendingDownload[] = []
	let bytes = 0
	for (const download of downloads) {
		const size = download.sizeBytes ?? 0
		if (
			current.length > 0 &&
			(current.length >= DOWNLOAD_BATCH_ITEMS || bytes + size > DOWNLOAD_BATCH_BYTES)
		) {
			chunks.push(current)
			current = []
			bytes = 0
		}
		current.push(download)
		bytes += size
	}
	if (current.length > 0) chunks.push(current)
	return chunks
}

export async function downloadMany(
	ctx: SyncContext,
	downloads: PendingDownload[],
	emit: EmitSyncEvent,
	settle: DownloadSettler,
	stopped: () => boolean = () => false,
): Promise<void> {
	for (const chunk of downloadChunks(downloads)) {
		if (stopped()) return
		const pending = new Map(chunk.map((download) => [download.path, download.version]))
		for (const path of pending.keys()) fileEvent(emit, path, "downloading")
		try {
			await downloadBatch(
				ctx.api,
				ctx.vaultId,
				chunk.map((download) => ({ path: download.path })),
				async (frame) => {
					if (!pending.has(frame.path)) return
					pending.delete(frame.path)
					let failure: unknown = null
					try {
						if (frame.status === "ok") {
							const remote = remoteContent(decrypt(frame.body, ctx.vek), frame.version)
							reportOutcome(emit, frame.path, await applyRemoteContent(ctx, frame.path, remote))
						} else if (frame.status === "forbidden") {
							throw new SyncError("forbidden", `Download ${frame.path}: forbidden`)
						} else if (frame.status !== "not_found") {
							throw new Error(`Download ${frame.path}: ${frame.status}`)
						}
					} catch (error) {
						failure = error
					}
					await settle(frame.path, failure)
				},
			)
		} catch (error) {
			for (const path of pending.keys()) await settle(path, error)
			continue
		}
		for (const path of pending.keys()) {
			await settle(path, new Error(`Download ${path}: missing from batch response`))
		}
	}
}

export interface FullSyncResult {
	latestEventId: string | null
	readOnlyLocal: string[]
}

export async function removeUnreadableFiles(
	ctx: SyncContext,
	states: Map<string, FileState>,
	local: Map<string, LocalFileInfo>,
	emit: EmitSyncEvent,
): Promise<void> {
	for (const [path, state] of states) {
		if (ctx.access.canRead(path)) continue
		const localFile = local.get(path)
		if (localFile && localFile.hash !== state.localHash) {
			log(emit, "warn", `Kept local changes to ${path}; you no longer have access to it`)
		} else if (localFile) {
			await syncRuntime().fs.rm(resolveInVault(ctx.vaultPath, path))
			local.delete(path)
			fileEvent(emit, path, "deleted")
		}
		ctx.db.deleteFileState(path)
		states.delete(path)
	}
}

export async function runFullSync(
	ctx: SyncContext,
	preferences: SyncPreferences,
	mode: PlanMode,
	emit: EmitSyncEvent,
): Promise<FullSyncResult> {
	const progress = (total: number, completed: number, phase: string) => {
		if (mode === "initial") emit("sync-initial-progress", { total, completed, phase })
	}
	progress(0, 0, "listing")
	const states = new Map<string, FileState>(
		ctx.db.listFileStates().map((state) => [state.filePath, state]),
	)
	const [{ files: remoteFiles, latestEventId }, local] = await Promise.all([
		listFileIndex(ctx.api, ctx.vaultId),
		scanLocalFiles(ctx.vaultPath, preferences, states),
	])
	await removeUnreadableFiles(ctx, states, local, emit)
	const { actions, settled, readOnlyLocal } = planFullSync(
		remoteFiles,
		states,
		local,
		preferences,
		ctx.access,
	)
	ctx.db.transaction(() => {
		for (const remote of remoteFiles) {
			ctx.db.upsertNoteMetadata(remote.path, remoteFileMetadata(remote))
		}
		for (const file of settled) settleFileState(ctx, file.path, file.hash, file.version, file)
	})
	progress(actions.length, 0, "syncing")

	let firstError: unknown = null
	let denied = false
	let completed = 0
	const finish = (path: string, error: unknown) => {
		if (error && isPathForbidden(error)) {
			log(emit, "warn", `${path} skipped: no access on the server`)
			fileEvent(emit, path, "no-access")
		} else if (error) {
			log(emit, "error", `Sync failed: ${path} — ${errorMessage(error)}`)
			fileEvent(emit, path, `error: ${errorMessage(error)}`)
			if (accessDenial(error, "path")) {
				denied = true
				firstError = error
			} else {
				firstError ??= error
			}
		}
		completed += 1
		progress(actions.length, completed, "syncing")
	}
	const run = async (action: PlannedAction) => {
		if (denied) return
		try {
			await executeOp(ctx, action, emit)
			finish(action.path, null)
		} catch (error) {
			finish(action.path, error)
		}
	}

	const sizes = new Map(remoteFiles.map((file) => [file.path, file.sizeBytes]))
	const byType = <T extends PlannedAction["type"]>(type: T) =>
		actions.filter((action): action is Extract<PlannedAction, { type: T }> => action.type === type)
	await downloadMany(
		ctx,
		byType("download").map((action) => ({ ...action, sizeBytes: sizes.get(action.path) })),
		emit,
		finish,
		() => denied,
	)
	for (const action of [...byType("delete"), ...byType("deleteRemote")]) await run(action)
	await runPool(byType("upload"), UPLOAD_CONCURRENCY, run)

	if (firstError) throw firstError
	if (mode === "initial") {
		progress(actions.length, actions.length, "complete")
		emit("sync-initial-complete", undefined)
	}
	return { latestEventId, readOnlyLocal }
}
