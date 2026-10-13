import {
	buildDiffRows,
	type DiffRow,
	getNotePathPresentation,
	noteCache,
	useSyncStore,
} from "@cortex/core"

import { createFixtureRemoteContent } from "@/features/conflict/conflictFixtures"

export interface NoteConflict {
	filePath: string
	title: string
	crumb: string[]
	relativePath: string
	localContent: string
	remoteContent: string
}

function relativeTo(filePath: string, vaultPath: string | undefined): string {
	if (vaultPath && filePath.startsWith(`${vaultPath}/`)) return filePath.slice(vaultPath.length + 1)
	return filePath
}

async function readLocalContent(filePath: string): Promise<string> {
	const entry = noteCache.getEntry(filePath) ?? (await noteCache.readEntry(filePath))
	return entry.content
}

export async function loadConflict(
	filePath: string,
	vaultPath: string | undefined,
): Promise<NoteConflict> {
	// stub: the sync engine does not report conflict contents on mobile; the remote side is a fixture
	const info = useSyncStore.getState().conflicts[filePath]
	const localContent = info?.localContent ?? (await readLocalContent(filePath))
	const remoteContent = info?.remoteContent ?? createFixtureRemoteContent(localContent)
	const presentation = getNotePathPresentation(filePath, vaultPath)
	return {
		crumb: presentation.segments.slice(0, -1).map((segment) => segment.label),
		filePath,
		localContent,
		relativePath: relativeTo(filePath, vaultPath),
		remoteContent,
		title: presentation.title,
	}
}

export function buildConflictDiff(conflict: NoteConflict): DiffRow[] {
	return buildDiffRows(conflict.localContent, conflict.remoteContent, 1)
}

function clearConflictMarker(filePath: string): void {
	useSyncStore.setState((state) => {
		delete state.conflicts[filePath]
	})
}

export async function keepLocalVersion(conflict: NoteConflict): Promise<void> {
	// stub: resolving goes through the sync engine once it runs on mobile; the local file stays as is
	clearConflictMarker(conflict.filePath)
}

export async function keepRemoteVersion(conflict: NoteConflict): Promise<void> {
	// stub: the remote content is written locally until the sync engine resolves conflicts on mobile
	const entry =
		noteCache.getEntry(conflict.filePath) ?? (await noteCache.readEntry(conflict.filePath))
	if (entry.content !== conflict.remoteContent) {
		noteCache.writeExternal(conflict.filePath, conflict.remoteContent)
	}
	clearConflictMarker(conflict.filePath)
}
