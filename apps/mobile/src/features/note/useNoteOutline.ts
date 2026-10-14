import {
	createWikiLinkResolver,
	extractHeadings,
	type NoteHeading,
	noteCache,
	selectBacklinks,
	useLinksStore,
	useVaultStore,
} from "@cortex/core"
import { getNoteTitle, joinPath, toVaultRelativePath } from "@cortex/platform/utils"
import { extractFrontmatterBody } from "@cortex/properties"
import { useSearchStore } from "@cortex/search"
import { useEffect, useMemo, useState } from "react"

import { ensureVaultIndexed } from "@/features/search/vaultIndexing"
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
			if (!cancelled)
				setState({ filePath, headings: extractHeadings(extractFrontmatterBody(content)) })
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

const UNLINKED_LIMIT = 20

export function useUnlinkedMentions(
	filePath: string | null,
	backlinks: readonly BacklinkView[],
): UnlinkedMentionView[] {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const [state, setState] = useState<{ key: string; mentions: UnlinkedMentionView[] } | null>(null)
	const key = `${filePath ?? ""}|${backlinks.map((backlink) => backlink.sourcePath).join("|")}`

	useEffect(() => {
		if (!filePath || !vaultPath) return
		let canceled = false
		const excludeIds = new Set(
			[filePath, ...backlinks.map((backlink) => backlink.sourcePath)].map(
				(path) => toVaultRelativePath(path, vaultPath) ?? path,
			),
		)
		void ensureVaultIndexed()
			.then(() =>
				useSearchStore
					.getState()
					.findPhrase(getNoteTitle(filePath), { excludeIds, limit: UNLINKED_LIMIT }),
			)
			.then((results) => {
				if (canceled) return
				setState({
					key,
					mentions: results.map((result) => ({
						sourcePath: joinPath(vaultPath, result.id),
						title: result.title,
						context: result.snippets[0]?.text ?? "",
					})),
				})
			})
			.catch(() => {
				if (!canceled) setState({ key, mentions: [] })
			})
		return () => {
			canceled = true
		}
	}, [backlinks, filePath, key, vaultPath])

	return state?.key === key ? state.mentions : []
}

export function revealHeading(heading: NoteHeading): void {
	workspaceChannel.sendCommand("mobile.reveal-line", heading.line)
}
