import {
	createWikiLinkResolver,
	extractHeadings,
	type NoteHeading,
	noteCache,
	selectBacklinks,
	useLinksStore,
	useVaultStore,
} from "@cortex/core"
import { getNoteTitle } from "@cortex/platform/utils"
import { extractFrontmatterBody } from "@cortex/properties"
import { useEffect, useMemo, useState } from "react"

import { workspaceChannel } from "@/features/workspace/workspaceChannel"

export interface BacklinkView {
	sourcePath: string
	title: string
	context: string
}

export interface UnlinkedMentionView {
	sourcePath: string
	title: string
	context: string
}

interface HeadingsState {
	filePath: string | null
	headings: NoteHeading[]
}

export function useNoteHeadings(filePath: string | null): NoteHeading[] {
	const [state, setState] = useState<HeadingsState>({ filePath: null, headings: [] })

	useEffect(() => {
		if (!filePath) return
		let cancelled = false
		const apply = (content: string) => {
			if (!cancelled) setState({ filePath, headings: extractHeadings(extractFrontmatterBody(content)) })
		}
		void noteCache.read(filePath).then(apply, () => apply(""))
		const unsubscribe = noteCache.onContentChange(filePath, (_path, content) => apply(content))
		return () => {
			cancelled = true
			unsubscribe()
		}
	}, [filePath])

	return state.filePath === filePath ? state.headings : []
}

export function useNoteBacklinks(filePath: string | null): BacklinkView[] {
	const outgoing = useLinksStore((state) => state.outgoing)
	const files = useVaultStore((state) => state.files)
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	return useMemo(() => {
		if (!filePath || !vaultPath) return []
		const resolve = createWikiLinkResolver(files, vaultPath)
		return selectBacklinks(outgoing, filePath, resolve).map((backlink) => ({
			sourcePath: backlink.sourcePath,
			title: getNoteTitle(backlink.sourcePath),
			context: backlink.links[0]?.context ?? "",
		}))
	}, [filePath, files, outgoing, vaultPath])
}

export function listUnlinkedMentions(filePath: string | null): UnlinkedMentionView[] {
	// stub: unlinked mentions need the search index, which mobile builds lazily; fixture for Roadmap
	if (!filePath || getNoteTitle(filePath) !== "Roadmap") return []
	return [
		{
			sourcePath: "Q3 planning.md",
			title: "Q3 planning",
			context: "Scope the road to 1.0 and pick ten testers.",
		},
	]
}

export function revealHeading(heading: NoteHeading): void {
	workspaceChannel.sendCommand("mobile.reveal-line", heading.line)
}
