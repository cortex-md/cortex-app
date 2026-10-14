import {
	buildDiffRows,
	type DiffRow,
	getNotePathPresentation,
	noteCache,
	useSyncStore,
} from "@cortex/core"
import { toVaultRelativePath } from "@cortex/platform/utils"

export interface NoteConflict {
	filePath: string
	title: string
	crumb: string[]
	relativePath: string
	localContent: string
	remoteContent: string
}

async function readLocalContent(filePath: string): Promise<string> {
	const entry = noteCache.getEntry(filePath) ?? (await noteCache.readEntry(filePath))
	return entry.content
}

export async function loadConflict(
	filePath: string,
	vaultPath: string | undefined,
): Promise<NoteConflict> {
	const relativePath = (vaultPath ? toVaultRelativePath(filePath, vaultPath) : null) ?? filePath
	const info = useSyncStore.getState().conflicts[relativePath]
	const localContent = info?.localContent ?? (await readLocalContent(filePath))
	const presentation = getNotePathPresentation(filePath, vaultPath)
	return {
		crumb: presentation.segments.slice(0, -1).map((segment) => segment.label),
		filePath,
		localContent,
		relativePath,
		remoteContent: info?.remoteContent ?? "",
		title: presentation.title,
	}
}

export function buildConflictDiff(conflict: NoteConflict): DiffRow[] {
	return buildDiffRows(conflict.localContent, conflict.remoteContent, 1)
}

export async function keepLocalVersion(conflict: NoteConflict): Promise<void> {
	await noteCache.flush(conflict.filePath)
	await useSyncStore.getState().resolveConflict(conflict.relativePath, { type: "keep_local" })
}

export async function keepRemoteVersion(conflict: NoteConflict): Promise<void> {
	await useSyncStore.getState().resolveConflict(conflict.relativePath, { type: "keep_remote" })
}
