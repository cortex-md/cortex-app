import type { SyncPreferences } from "@cortex/platform"
import { hashBytes } from "@cortex/platform/hash"
import { shouldIgnoreSyncPath, shouldSkipSyncDirectory } from "@cortex/platform/sync-rules"
import type { RemoteChange, RemoteFileInfo } from "@cortex/sync-api"
import type { SyncAccess } from "./access"
import type { FileState, NoteMetadataRecord } from "./db"
import type { SyncOp } from "./queue"
import { type SyncDirEntry, syncRuntime } from "./runtime"
import { runPool } from "./util"

export interface LocalFileInfo {
	hash: string
	mtime: number
	size: number
}

export type PlannedAction = Extract<
	SyncOp,
	{ type: "download" | "upload" | "delete" | "deleteRemote" }
>

export interface SettledFile extends LocalFileInfo {
	path: string
	version: number
}

export interface SyncPlan {
	actions: PlannedAction[]
	settled: SettledFile[]
	readOnlyLocal: string[]
}

const LOCAL_SCAN_CONCURRENCY = 16

export async function scanLocalFiles(
	vaultPath: string,
	preferences: SyncPreferences,
	states: Map<string, FileState>,
): Promise<Map<string, LocalFileInfo>> {
	const candidates: Array<{ relative: string; fullPath: string }> = []
	const walk = async (directory: string, prefix: string): Promise<void> => {
		let entries: SyncDirEntry[]
		try {
			entries = await syncRuntime().fs.readdir(directory)
		} catch {
			return
		}
		const subdirectories: Promise<void>[] = []
		for (const entry of entries) {
			const relative = prefix ? `${prefix}/${entry.name}` : entry.name
			const fullPath = syncRuntime().path.join(directory, entry.name)
			if (entry.isDirectory()) {
				if (!shouldSkipSyncDirectory(relative, preferences)) {
					subdirectories.push(walk(fullPath, relative))
				}
			} else if (
				(entry.isFile() || entry.isSymbolicLink()) &&
				!shouldIgnoreSyncPath(relative, preferences)
			) {
				candidates.push({ relative, fullPath })
			}
		}
		await Promise.all(subdirectories)
	}
	await walk(vaultPath, "")

	const files = new Map<string, LocalFileInfo>()
	await runPool(candidates, LOCAL_SCAN_CONCURRENCY, async ({ relative, fullPath }) => {
		const info = await fileInfo(fullPath, states.get(relative))
		if (info) files.set(relative, info)
	})
	return files
}

async function fileInfo(path: string, state: FileState | undefined): Promise<LocalFileInfo | null> {
	try {
		const stats = await syncRuntime().fs.stat(path)
		if (!stats.isFile()) return null
		const mtime = Math.trunc(stats.mtimeMs)
		if (state?.localHash && state.localMtime === mtime && state.localSize === stats.size) {
			return { hash: state.localHash, mtime, size: stats.size }
		}
		return { hash: hashBytes(await syncRuntime().fs.readFile(path)), mtime, size: stats.size }
	} catch {
		return null
	}
}

const ACTION_ORDER: Record<PlannedAction["type"], number> = {
	download: 0,
	delete: 1,
	deleteRemote: 2,
	upload: 3,
}

export function planFullSync(
	remoteFiles: RemoteFileInfo[],
	states: Map<string, FileState>,
	local: Map<string, LocalFileInfo>,
	preferences: SyncPreferences,
	access: SyncAccess,
): SyncPlan {
	const actions: PlannedAction[] = []
	const settled: SettledFile[] = []
	const readOnlyLocal: string[] = []
	const remotePaths = new Set<string>()

	for (const remote of remoteFiles) {
		const path = remote.path
		remotePaths.add(path)
		const state = states.get(path)
		if (shouldIgnoreSyncPath(path, preferences) || state?.syncStatus === "conflict") continue
		if (!access.canRead(path)) continue
		const localFile = local.get(path)
		const download: PlannedAction = { type: "download", path, version: remote.version }
		if (!localFile) {
			const deletedLocally = state && state.ancestorHash === remote.checksum
			actions.push(
				deletedLocally && access.canWrite(path) ? { type: "deleteRemote", path } : download,
			)
			continue
		}
		if (localFile.hash === remote.checksum) {
			if (
				state?.localHash !== localFile.hash ||
				state.serverVersion !== remote.version ||
				state.localMtime !== localFile.mtime ||
				state.localSize !== localFile.size
			) {
				settled.push({ ...localFile, path, version: remote.version })
			}
			continue
		}
		if (
			!state ||
			localFile.hash === state.ancestorHash ||
			remote.checksum !== state.ancestorHash ||
			!access.canWrite(path)
		) {
			actions.push(download)
		} else {
			actions.push({ type: "upload", path })
		}
	}

	for (const [path, localFile] of local) {
		if (remotePaths.has(path) || shouldIgnoreSyncPath(path, preferences)) continue
		if (!access.canRead(path)) continue
		const state = states.get(path)
		if (state?.syncStatus === "conflict") continue
		if (state && localFile.hash === state.localHash) {
			actions.push({ type: "delete", path })
		} else if (access.canWrite(path)) {
			actions.push({ type: "upload", path })
		} else {
			readOnlyLocal.push(path)
		}
	}

	actions.sort((left, right) => ACTION_ORDER[left.type] - ACTION_ORDER[right.type])
	return { actions, settled, readOnlyLocal }
}

export function remoteFileMetadata(remote: RemoteFileInfo): NoteMetadataRecord {
	return {
		createdAt: remote.createdAt,
		createdBy: remote.createdBy,
		lastEditedAt: remote.updatedAt,
		lastEditedBy: remote.lastModifiedBy,
		lastDeviceId: remote.lastDeviceId,
	}
}

export interface PlannedChange {
	op: SyncOp | null
	metadata: NoteMetadataRecord | null
}

export function planRemoteChange(
	change: RemoteChange,
	ownDeviceId: string,
	preferences: SyncPreferences,
): PlannedChange {
	if (change.deviceId === ownDeviceId || shouldIgnoreSyncPath(change.path, preferences)) {
		return { op: null, metadata: null }
	}
	const created = change.type === "file_created"
	const metadata: NoteMetadataRecord = {
		createdAt: created ? change.createdAt : null,
		createdBy: created ? change.actorId : null,
		lastEditedAt: change.createdAt,
		lastEditedBy: change.actorId,
		lastDeviceId: change.deviceId,
	}
	switch (change.type) {
		case "file_created":
		case "file_updated":
			return { op: { type: "download", path: change.path, version: change.version }, metadata }
		case "file_deleted":
			return { op: { type: "delete", path: change.path }, metadata: null }
		case "file_renamed":
			return {
				op: change.oldPath
					? { type: "rename", oldPath: change.oldPath, newPath: change.path }
					: { type: "download", path: change.path, version: change.version },
				metadata,
			}
		default:
			return { op: null, metadata: null }
	}
}
