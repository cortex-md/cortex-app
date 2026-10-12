import {
	getFolderNoteCounts,
	joinPath,
	selectSortedTags,
	useTagsStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import {
	formatSearchFilterSummary,
	hasSearchFilters,
	parseSearchQuery,
	type SearchResult,
	useSearchStore,
} from "@cortex/search"
import { Button, Spinner } from "@cortex/ui"
import { ChevronDownIcon, ChevronsDownUpIcon, SearchIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback"
import { formatCount } from "@/utils/format"
import { type SidebarToolEmptyState, SidebarToolView } from "../sidebar/SidebarToolView"
import { getSidebarNotePresentation } from "../sidebar/sidebarNotePresentation"
import { HighlightedSnippet } from "./HighlightedSnippet"
import { SearchQueryField } from "./SearchQueryField"

const SEARCH_SIDEBAR_RESULT_LIMIT = 100
const SEARCH_DEBOUNCE_MS = 150

const INDEXING_EMPTY_STATE: SidebarToolEmptyState = {
	icon: <Spinner className="size-5 text-muted-foreground" />,
	message: "Indexing vault...",
}
const IDLE_EMPTY_STATE: SidebarToolEmptyState = {
	icon: <SearchIcon className="size-6 text-muted-foreground" />,
	message: "Search your notes",
}
const NO_RESULTS_EMPTY_STATE: SidebarToolEmptyState = {
	icon: <SearchIcon className="size-6 text-muted-foreground" />,
	message: "No results found",
}

function getSearchEmptyState(
	indexing: boolean,
	query: string,
	resultCount: number,
): SidebarToolEmptyState | null {
	if (indexing) return INDEXING_EMPTY_STATE
	if (!query.trim()) return IDLE_EMPTY_STATE
	if (resultCount === 0) return NO_RESULTS_EMPTY_STATE
	return null
}

interface SearchResultGroupProps {
	result: SearchResult
	vaultPath: string | undefined
	collapsed: boolean
	query: string
	onToggle: (id: string) => void
}

function SearchResultGroup({
	result,
	vaultPath,
	collapsed,
	query,
	onToggle,
}: SearchResultGroupProps) {
	const filePath = vaultPath ? joinPath(vaultPath, result.id) : result.id
	const notePath = getSidebarNotePresentation(filePath, vaultPath)
	const openMatch = (snippetIndex: number) => {
		const matchIndex = result.snippets
			.slice(0, snippetIndex)
			.reduce((total, snippet) => total + snippet.ranges.length, 0)
		useSearchStore.getState().setNoteHighlight({ filePath, query, matchIndex })
		useWorkspaceStore.getState().openTab(filePath)
	}

	return (
		<div className="sidebar-search-file">
			<Button
				variant="ghost"
				className="sidebar-search-file-header"
				aria-expanded={!collapsed}
				onClick={() => onToggle(result.id)}
				onDoubleClick={() => openMatch(0)}
			>
				<ChevronDownIcon className="sidebar-search-chevron" aria-hidden="true" />
				<span className="sidebar-search-file-title">
					<span className="sidebar-search-title">{notePath.title || result.title}</span>
					{notePath.folder && <span className="sidebar-search-path">{notePath.folder}</span>}
				</span>
				{result.matchCount > 0 && <span className="sidebar-search-count">{result.matchCount}</span>}
			</Button>
			{!collapsed &&
				(result.snippets.length > 0 ? (
					result.snippets.map((snippet, index) => (
						<Button
							key={`${result.id}:${snippet.text}`}
							variant="ghost"
							className="sidebar-search-snippet"
							onClick={() => openMatch(index)}
						>
							<span>
								<HighlightedSnippet snippet={snippet} markClassName="sidebar-search-mark" />
							</span>
						</Button>
					))
				) : (
					<Button variant="ghost" className="sidebar-search-snippet" onClick={() => openMatch(0)}>
						<span>Open note</span>
					</Button>
				))}
		</div>
	)
}

export function SearchSidebar() {
	const query = useSearchStore((s) => s.query)
	const results = useSearchStore((s) => s.results)
	const runQuery = useSearchStore((s) => s.runQuery)
	const indexing = useSearchStore((s) => s.indexing)
	const recentQueries = useSearchStore((s) => s.recentQueries)
	const vault = useVaultStore((s) => s.vault)
	const files = useVaultStore((s) => s.files)
	const tagIndex = useTagsStore((s) => s.tagIndex)
	const tagColors = useTagsStore((s) => s.tagColors)
	const inputRef = useRef<HTMLInputElement>(null)
	const [localQuery, setLocalQuery] = useState(query)
	const [syncedStoreQuery, setSyncedStoreQuery] = useState(query)
	const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set())
	const scheduleQuery = useDebouncedCallback(runQuery, SEARCH_DEBOUNCE_MS)

	useEffect(() => {
		inputRef.current?.focus()
	}, [])

	if (syncedStoreQuery !== query) {
		setSyncedStoreQuery(query)
		if (localQuery.trim() !== query.trim()) setLocalQuery(query)
	}

	const folders = useMemo(
		() => (vault ? getFolderNoteCounts(files, vault.path) : []),
		[files, vault],
	)
	const tags = useMemo(
		() =>
			selectSortedTags({ tagIndex, tagColors }).map((entry) => ({
				tag: entry.tag,
				count: entry.filePaths.length,
			})),
		[tagColors, tagIndex],
	)

	const handleQueryChange = (value: string) => {
		setLocalQuery(value)
		scheduleQuery(value)
	}

	const handleSubmit = (value: string) => {
		setLocalQuery(value)
		void runQuery(value)
		useSearchStore.getState().addRecentQuery(value)
	}

	const toggleCollapsed = (id: string) => {
		setCollapsedIds((current) => {
			const next = new Set(current)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const parsed = parseSearchQuery(localQuery)
	const visibleResults = results.slice(0, SEARCH_SIDEBAR_RESULT_LIMIT)
	const matchTotal = visibleResults.reduce((total, result) => total + result.matchCount, 0)
	const allCollapsed =
		visibleResults.length > 0 && visibleResults.every((result) => collapsedIds.has(result.id))

	return (
		<SidebarToolView
			title="Search"
			filterLabel="Search notes"
			filterIcon={<SearchIcon />}
			filterPlaceholder="Search in vault..."
			filterValue={localQuery}
			onFilterChange={handleQueryChange}
			inputRef={inputRef}
			field={
				<SearchQueryField
					inputRef={inputRef}
					value={localQuery}
					folders={folders}
					tags={tags}
					recentQueries={recentQueries}
					onChange={handleQueryChange}
					onSubmit={handleSubmit}
				/>
			}
			headerAction={
				visibleResults.length > 0 && (
					<Button
						variant="ghost"
						size="icon-xs"
						className="sidebar-tool-action"
						aria-label={allCollapsed ? "Expand all" : "Collapse all"}
						title={allCollapsed ? "Expand all" : "Collapse all"}
						onClick={() =>
							setCollapsedIds(
								allCollapsed ? new Set() : new Set(visibleResults.map((result) => result.id)),
							)
						}
					>
						<ChevronsDownUpIcon />
					</Button>
				)
			}
			count={
				visibleResults.length !== 0 &&
				`${formatCount(visibleResults.length, "note")}${matchTotal > 0 ? ` · ${formatCount(matchTotal, "match", "matches")}` : ""}`
			}
			meta={
				hasSearchFilters(parsed) && (
					<span className="sidebar-tool-filters">in {formatSearchFilterSummary(parsed)}</span>
				)
			}
			empty={getSearchEmptyState(indexing, localQuery, visibleResults.length)}
		>
			<div className="sidebar-tool-list" role="tree" aria-label="Search results">
				{visibleResults.map((result) => (
					<SearchResultGroup
						key={result.id}
						result={result}
						vaultPath={vault?.path}
						collapsed={collapsedIds.has(result.id)}
						query={parsed.text}
						onToggle={toggleCollapsed}
					/>
				))}
			</div>
		</SidebarToolView>
	)
}
