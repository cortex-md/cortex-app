import { openThreadCount } from "@cortex/comments"
import {
	type Backlink,
	createWikiLinkResolver,
	findActiveHeadingIndex,
	getNoteTitle,
	joinPath,
	openNoteAtLine,
	type RightSidebarPanel,
	selectActiveDocument,
	selectBacklinks,
	selectNoteComments,
	toVaultRelativePath,
	useCommentsStore,
	useEditorStore,
	useLinksStore,
	useUIStore,
	useVaultStore,
} from "@cortex/core"
import { type SearchResult, useSearchStore } from "@cortex/search"
import { Button, Tabs, TabsList, TabsTrigger } from "@cortex/ui"
import { FileTextIcon } from "lucide-react"
import { lazy, Suspense, useMemo, useState } from "react"
import { formatCount } from "@/utils/format"
import { HighlightedSnippet } from "../search/HighlightedSnippet"

const CommentsPanel = lazy(() => import("../comments/CommentsPanel"))

function setPanel(panel: string) {
	useUIStore.getState().setRightSidebarLayout({ panel: panel as RightSidebarPanel })
}

function OutlinePanel() {
	const document = useEditorStore(selectActiveDocument)
	const activeIndex = useEditorStore((state) => {
		const activeDocument = selectActiveDocument(state)
		return activeDocument
			? findActiveHeadingIndex(activeDocument.headings, state.cursor?.line ?? 0)
			: -1
	})
	if (!document || document.headings.length === 0) {
		return <p className="right-sidebar-empty">No headings in this note.</p>
	}
	const minimumLevel = Math.min(...document.headings.map((heading) => heading.level))
	return (
		<nav className="right-sidebar-list" aria-label="Outline">
			{document.headings.map((heading, index) => (
				<Button
					key={`${heading.line}:${heading.text}`}
					variant="ghost"
					className="right-sidebar-outline-item"
					data-active={index === activeIndex || undefined}
					style={{ paddingLeft: 8 + (heading.level - minimumLevel) * 12 }}
					onClick={() => openNoteAtLine(document.filePath, heading.line)}
				>
					<span>{heading.text}</span>
				</Button>
			))}
		</nav>
	)
}

function MentionContext({ context, target }: { context: string; target: string }) {
	const marker = `[[${target}`
	const start = context.indexOf(marker)
	if (start === -1) return <span className="right-sidebar-item-context">{context}</span>
	const end = context.indexOf("]]", start)
	const stop = end === -1 ? context.length : end + 2
	return (
		<span className="right-sidebar-item-context">
			{context.slice(0, start)}
			<mark>{context.slice(start, stop)}</mark>
			{context.slice(stop)}
		</span>
	)
}

function BacklinkItem({ backlink }: { backlink: Backlink }) {
	const [firstLink] = backlink.links
	return (
		<Button
			variant="ghost"
			className="right-sidebar-item"
			onClick={() => openNoteAtLine(backlink.sourcePath, firstLink.line)}
		>
			<b>
				<FileTextIcon aria-hidden="true" />
				{getNoteTitle(backlink.sourcePath)}
			</b>
			<MentionContext context={firstLink.context} target={firstLink.target} />
		</Button>
	)
}

function UnlinkedMentionItem({ result, vaultPath }: { result: SearchResult; vaultPath: string }) {
	const filePath = joinPath(vaultPath, result.id)
	const [snippet] = result.snippets
	return (
		<Button
			variant="ghost"
			className="right-sidebar-item"
			onClick={() => openNoteAtLine(filePath, 0)}
		>
			<b>
				<FileTextIcon aria-hidden="true" />
				{result.title}
			</b>
			{snippet && (
				<span className="right-sidebar-item-context">
					<HighlightedSnippet snippet={snippet} />
				</span>
			)}
		</Button>
	)
}

function BacklinksPanel({ filePath }: { filePath: string }) {
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const outgoing = useLinksStore((state) => state.outgoing)
	const [unlinked, setUnlinked] = useState<{ filePath: string; results: SearchResult[] } | null>(
		null,
	)
	const backlinks = useMemo(
		() =>
			vault ? selectBacklinks(outgoing, filePath, createWikiLinkResolver(files, vault.path)) : [],
		[files, filePath, outgoing, vault],
	)
	if (!vault) return null

	const loadUnlinkedMentions = async () => {
		const excludeIds = new Set(
			[filePath, ...backlinks.map((backlink) => backlink.sourcePath)].map(
				(path) => toVaultRelativePath(path, vault.path) ?? path,
			),
		)
		const results = await useSearchStore
			.getState()
			.findPhrase(getNoteTitle(filePath), { excludeIds, limit: 20 })
		setUnlinked({ filePath, results })
	}

	const unlinkedResults = unlinked?.filePath === filePath ? unlinked.results : null

	return (
		<div className="right-sidebar-list">
			<div className="right-sidebar-label">
				{backlinks.length === 0
					? "No linked mentions"
					: `${formatCount(backlinks.length, "linked mention")}`}
			</div>
			{backlinks.map((backlink) => (
				<BacklinkItem key={backlink.sourcePath} backlink={backlink} />
			))}
			<div className="right-sidebar-label right-sidebar-label--spaced">Unlinked mentions</div>
			{unlinkedResults === null ? (
				<Button
					variant="ghost"
					size="xs"
					className="right-sidebar-more"
					onClick={() => void loadUnlinkedMentions()}
				>
					Find unlinked mentions
				</Button>
			) : unlinkedResults.length === 0 ? (
				<p className="right-sidebar-empty">No unlinked mentions.</p>
			) : (
				unlinkedResults.map((result) => (
					<UnlinkedMentionItem key={result.id} result={result} vaultPath={vault.path} />
				))
			)}
		</div>
	)
}

function OpenCommentCount({ filePath }: { filePath: string | null }) {
	const count = useCommentsStore((state) => openThreadCount(selectNoteComments(state, filePath)))
	if (count === 0) return null
	return <span className="right-sidebar-tab-count">{count}</span>
}

export function RightSidebar() {
	const collapsed = useUIStore((state) => state.rightSidebarCollapsed)
	const panel = useUIStore((state) => state.rightSidebarPanel)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)

	return (
		<aside
			className="right-sidebar"
			aria-label="Right sidebar"
			data-collapsed={collapsed || undefined}
			data-panel={panel}
			inert={collapsed}
		>
			<div className="right-sidebar-inner">
				<Tabs value={panel} onValueChange={setPanel}>
					<TabsList className="right-sidebar-tabs" aria-label="Note panels">
						<TabsTrigger value="comments">
							Comments
							<OpenCommentCount filePath={activeFilePath} />
						</TabsTrigger>
						<TabsTrigger value="outline">Outline</TabsTrigger>
						<TabsTrigger value="backlinks">Backlinks</TabsTrigger>
					</TabsList>
				</Tabs>
				<div className="right-sidebar-scroll">
					{collapsed ? null : !activeFilePath ? (
						<p className="right-sidebar-empty">
							Open a note to see its comments, outline, and backlinks.
						</p>
					) : panel === "comments" ? (
						<Suspense fallback={null}>
							<CommentsPanel filePath={activeFilePath} />
						</Suspense>
					) : panel === "outline" ? (
						<OutlinePanel />
					) : (
						<BacklinksPanel filePath={activeFilePath} />
					)}
				</div>
			</div>
		</aside>
	)
}
