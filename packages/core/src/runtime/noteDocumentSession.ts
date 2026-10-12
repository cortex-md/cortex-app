import { locateFrontmatter, projectRawNote, type RawNoteProjection } from "@cortex/properties"
import { noteCache } from "../noteCache"
import { useWorkspaceStore } from "../stores/workspaceStore"

export interface NoteDocumentSnapshot {
	filePath: string
	body: string
	projection: RawNoteProjection
	revision: number
}

export interface NoteDocumentSessionOptions {
	onChange: (snapshot: NoteDocumentSnapshot) => void
	onError?: (error: unknown) => void
}

export interface NoteBodyUpdateOptions {
	baseRevision?: number
}

export interface NoteDocumentSession {
	readonly filePath: string
	getSnapshot: () => NoteDocumentSnapshot | null
	getRawContent: () => string | null
	updateBody: (body: string, options?: NoteBodyUpdateOptions) => boolean
	dispose: () => void
}

function getFrontmatterPrefix(rawContent: string): string {
	const location = locateFrontmatter(rawContent)
	return location ? rawContent.slice(0, location.to) : ""
}

function markFileTabsDirty(filePath: string): void {
	const workspace = useWorkspaceStore.getState()
	for (const pane of Object.values(workspace.panes)) {
		for (const tab of pane.tabs) {
			if (tab.tabType === "file" && tab.filePath === filePath && !tab.isDirty) {
				workspace.markTabDirty(tab.id, true)
			}
		}
	}
}

export function openNoteDocumentSession(
	filePath: string,
	options: NoteDocumentSessionOptions,
): NoteDocumentSession {
	let disposed = false
	let rawContent: string | null = null
	let frontmatterPrefix = ""
	let snapshot: NoteDocumentSnapshot | null = null
	let tabsMarkedDirty = false

	const applyRawContent = (nextRawContent: string) => {
		if (rawContent === nextRawContent) return
		const nextPrefix = getFrontmatterPrefix(nextRawContent)
		const body = nextRawContent.slice(nextPrefix.length)
		const projection =
			snapshot && nextPrefix === frontmatterPrefix
				? snapshot.projection
				: projectRawNote(nextRawContent)
		const revision = snapshot ? snapshot.revision + (body === snapshot.body ? 0 : 1) : 1
		rawContent = nextRawContent
		frontmatterPrefix = nextPrefix
		snapshot = { filePath, body, projection, revision }
		options.onChange(snapshot)
	}

	const cachedEntry = noteCache.getEntry(filePath)
	if (cachedEntry) {
		applyRawContent(cachedEntry.content)
	} else {
		noteCache
			.readEntry(filePath)
			.then((entry) => {
				if (!disposed && rawContent === null) applyRawContent(entry.content)
			})
			.catch((error) => {
				if (!disposed) options.onError?.(error)
			})
	}

	const unsubscribe = noteCache.onContentChange(filePath, (_path, content) => {
		if (!disposed) applyRawContent(content)
	})

	return {
		filePath,
		getSnapshot: () => snapshot,
		getRawContent: () => rawContent,
		updateBody: (body, updateOptions) => {
			if (disposed || rawContent === null || !snapshot) return false
			const baseRevision = updateOptions?.baseRevision
			if (baseRevision !== undefined && baseRevision < snapshot.revision) return false
			if (body === snapshot.body) return true
			rawContent = `${frontmatterPrefix}${body}`
			snapshot = { ...snapshot, body }
			if (noteCache.hasLiveDocument(filePath)) return true
			noteCache.write(filePath, rawContent)
			if (!tabsMarkedDirty) {
				tabsMarkedDirty = true
				markFileTabsDirty(filePath)
			}
			return true
		},
		dispose: () => {
			disposed = true
			unsubscribe()
		},
	}
}
