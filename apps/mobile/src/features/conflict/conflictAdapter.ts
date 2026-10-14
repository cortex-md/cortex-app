import {
	buildDiffRows,
	type DiffRow,
	getNotePathPresentation,
	noteCache,
	useSyncStore,
} from "@cortex/core"
import type { ConflictResolution } from "@cortex/platform"
import { toVaultRelativePath } from "@cortex/platform/utils"

import { reloadSyncConflicts } from "@/features/sync/syncConflicts"

export interface NoteConflict {
	filePath: string
	title: string
	crumb: string[]
	relativePath: string
	localContent: string
	remoteContent: string | null
}

async function readLocalContent(filePath: string): Promise<string> {
	const entry = noteCache.getEntry(filePath) ?? (await noteCache.readEntry(filePath))
	return entry.content
}

function conflictInfo(relativePath: string) {
	return useSyncStore.getState().conflicts[relativePath]
}

export async function loadConflict(
	filePath: string,
	vaultPath: string | undefined,
): Promise<NoteConflict> {
	const relativePath = (vaultPath ? toVaultRelativePath(filePath, vaultPath) : null) ?? filePath
	let info = conflictInfo(relativePath)
	if (!info || info.localContent === null || info.remoteContent === null) {
		await reloadSyncConflicts()
		info = conflictInfo(relativePath) ?? info
	}
	const presentation = getNotePathPresentation(filePath, vaultPath)
	return {
		crumb: presentation.segments.slice(0, -1).map((segment) => segment.label),
		filePath,
		localContent: info?.localContent ?? (await readLocalContent(filePath)),
		relativePath,
		remoteContent: info?.remoteContent ?? null,
		title: presentation.title,
	}
}

export function buildConflictDiff(conflict: NoteConflict): DiffRow[] {
	return buildDiffRows(conflict.localContent, conflict.remoteContent ?? "", 1)
}

async function resolve(relativePath: string, resolution: ConflictResolution): Promise<void> {
	const previousError = useSyncStore.getState().error
	await useSyncStore.getState().resolveConflict(relativePath, resolution)
	const error = useSyncStore.getState().error
	if (error && error !== previousError) throw new Error(error)
}

export async function keepLocalVersion(conflict: NoteConflict): Promise<void> {
	await noteCache.flush(conflict.filePath)
	await resolve(conflict.relativePath, { type: "keep_local" })
}

export async function keepRemoteVersion(conflict: NoteConflict): Promise<void> {
	await resolve(conflict.relativePath, { type: "keep_remote" })
}

export async function keepBothVersions(conflict: NoteConflict): Promise<void> {
	const content = [
		"<<<<<<< This device",
		conflict.localContent,
		"=======",
		conflict.remoteContent ?? "",
		">>>>>>> Other device",
		"",
	].join("\n")
	await resolve(conflict.relativePath, { content, type: "merged" })
}

export async function resolveConflictByPath(
	filePath: string,
	vaultPath: string | undefined,
	choice: "local" | "remote",
): Promise<void> {
	const conflict = await loadConflict(filePath, vaultPath)
	if (choice === "local") await keepLocalVersion(conflict)
	else await keepRemoteVersion(conflict)
}
