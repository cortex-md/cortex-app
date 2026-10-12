import type { OpenTabOptions } from "@cortex/core"
import {
	formatRelativeTime,
	getFileModifiedTimes,
	getNoteTitle,
	getParentPath,
	getRecentFilePaths,
	joinPath,
	toVaultRelativePath,
	useBookmarksStore,
	useUIStore,
	useVaultStore,
	useWorkspaceStore,
	type VaultMetadata,
} from "@cortex/core"
import { formatHotkeyDisplay } from "@cortex/hotkeys"
import { type SearchResult, type SearchSnippet, useSearchStore } from "@cortex/search"
import {
	CommandDialog,
	CommandEmpty,
	CommandFooterHints,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
	Kbd,
	Toggle,
} from "@cortex/ui"
import { PanelRightIcon } from "lucide-react"
import type { KeyboardEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback"
import { HighlightedSnippet } from "../search/HighlightedSnippet"
import { QuickFinderPreview } from "./QuickFinderPreview"

interface QuickFinderOpenItem {
	type: "recent" | "search"
	value: string
	title: string
	folder: string
	filePath: string
	snippet?: SearchSnippet
}

const QUICK_FINDER_RESULT_LIMIT = 20
const CONTENT_SEARCH_DELAY_MS = 120
const MIN_CONTENT_QUERY_LENGTH = 3

interface QuickFinderCreateItem {
	type: "create"
	value: string
	title: string
	query: string
}

type QuickFinderItem = QuickFinderOpenItem | QuickFinderCreateItem

interface QuickFinderResults {
	query: string
	results: SearchResult[]
}

interface PendingOpen {
	newTab: boolean
	split: boolean
}

const EMPTY_RESULTS: QuickFinderResults = { query: "", results: [] }

const QUICK_FINDER_FOOTER_HINTS = [
	{ keys: ["↑", "↓"], label: "navigate" },
	{ keys: ["Return"], label: "open" },
	{ keys: [formatHotkeyDisplay("mod"), "Return"], label: "new tab" },
	{
		keys: [formatHotkeyDisplay("mod"), formatHotkeyDisplay("shift"), "Return"],
		label: "open right",
	},
	{ keys: [formatHotkeyDisplay("shift"), "Return"], label: "create" },
	{ keys: [">"], label: "commands" },
]

function folderFromPath(filePath: string, vaultPath: string): string {
	return getParentPath(toVaultRelativePath(filePath, vaultPath) ?? filePath)
}

function buildOpenOptions(
	activePaneId: string,
	newTab: boolean,
	split: boolean,
): OpenTabOptions | undefined {
	if (split) return { paneId: activePaneId, split: "horizontal" }
	if (newTab) return { paneId: activePaneId }
	return undefined
}

function getSelectedCommandValue(commandElement: Element): string {
	return (
		commandElement
			.querySelector<HTMLElement>('[cmdk-item=""][aria-selected="true"]')
			?.getAttribute("data-value") ?? ""
	)
}

function QuickFinderOpenRow({
	item,
	modifiedAt,
}: {
	item: QuickFinderOpenItem
	modifiedAt: number | undefined
}) {
	return (
		<>
			<span className="command-item-copy">
				<span className="quick-finder-path">
					{item.folder && <span className="quick-finder-dir">{item.folder}/</span>}
					<span className="quick-finder-name">{item.title}</span>
				</span>
				{item.snippet && (
					<span className="quick-finder-snippet">
						<HighlightedSnippet snippet={item.snippet} />
					</span>
				)}
			</span>
			{modifiedAt && (
				<span className="quick-finder-when">{formatRelativeTime(modifiedAt, "short")}</span>
			)}
		</>
	)
}

function QuickFinderCreateRow({ item }: { item: QuickFinderCreateItem }) {
	return (
		<>
			<span className="command-item-title">{item.title}</span>
			<CommandShortcut className="quick-finder-create-shortcut">Enter to create</CommandShortcut>
		</>
	)
}

export function QuickFinder() {
	const quickFinderOpen = useUIStore((s) => s.quickFinderOpen)
	const vault = useVaultStore((s) => s.vault)
	if (!quickFinderOpen || !vault) return null
	return <QuickFinderDialog vault={vault} />
}

function QuickFinderDialog({ vault }: { vault: VaultMetadata }) {
	const toggleQuickFinder = useUIStore((s) => s.toggleQuickFinder)
	const createFile = useVaultStore((s) => s.createFile)
	const openTab = useWorkspaceStore((s) => s.openTab)
	const panes = useWorkspaceStore((s) => s.panes)
	const recentlyClosed = useWorkspaceStore((s) => s.recentlyClosed)
	const activePaneId = useWorkspaceStore((s) => s.activePaneId)
	const request = useUIStore((s) => s.quickFinderRequest)
	const preview = useUIStore((s) => s.quickFinderPreview)
	const files = useVaultStore((s) => s.files)
	const indexing = useSearchStore((s) => s.indexing)
	const modifiedTimes = getFileModifiedTimes(files)

	const [query, setQuery] = useState(() =>
		request.kind === "relink-bookmark" ? request.query : "",
	)
	const [selectedValue, setSelectedValue] = useState("")
	const [selectionQuery, setSelectionQuery] = useState("")
	const [titleResults, setTitleResults] = useState(EMPTY_RESULTS)
	const [contentResults, setContentResults] = useState(EMPTY_RESULTS)
	const latestQueryRef = useRef("")
	const pendingOpenRef = useRef<PendingOpen | null>(null)

	const trimmedQuery = query.trim()
	const searchQuery = trimmedQuery ? titleResults.query : ""

	const loadContentResults = useDebouncedCallback(async (nextQuery: string) => {
		const { findNotes, loadMatches } = useSearchStore.getState()
		const results = await findNotes(nextQuery, { limit: QUICK_FINDER_RESULT_LIMIT })
		if (latestQueryRef.current !== nextQuery) return
		const withMatches = await loadMatches(results, nextQuery)
		if (latestQueryRef.current === nextQuery) {
			setContentResults({ query: nextQuery, results: withMatches })
		}
	}, CONTENT_SEARCH_DELAY_MS)

	useEffect(() => {
		latestQueryRef.current = trimmedQuery
		if (!trimmedQuery || indexing) return
		void useSearchStore
			.getState()
			.searchTitles(trimmedQuery)
			.then((results) => {
				if (latestQueryRef.current === trimmedQuery) {
					setTitleResults({ query: trimmedQuery, results })
				}
			})
		if (trimmedQuery.length >= MIN_CONTENT_QUERY_LENGTH && !trimmedQuery.startsWith(">")) {
			loadContentResults(trimmedQuery)
		}
	}, [indexing, loadContentResults, trimmedQuery])

	const handleQueryChange = (nextQuery: string) => {
		if (nextQuery.startsWith(">")) {
			toggleQuickFinder()
			useUIStore.getState().toggleCommandPalette()
			return
		}
		pendingOpenRef.current = null
		if (!nextQuery.trim()) setTitleResults(EMPTY_RESULTS)
		setQuery(nextQuery)
	}

	const recentFilePaths = useMemo(
		() => getRecentFilePaths(panes, recentlyClosed),
		[panes, recentlyClosed],
	)

	const searchResults = useMemo(() => {
		if (!searchQuery) return []
		const titles = titleResults.results.slice(0, QUICK_FINDER_RESULT_LIMIT)
		const matchedContent =
			contentResults.query === searchQuery
				? contentResults.results.filter((result) => result.snippets.length > 0)
				: []
		const seen = new Set(titles.map((result) => result.id))
		return [...titles, ...matchedContent.filter((result) => !seen.has(result.id))].slice(
			0,
			QUICK_FINDER_RESULT_LIMIT,
		)
	}, [contentResults, searchQuery, titleResults])

	const openItems = useMemo<QuickFinderOpenItem[]>(() => {
		if (!searchQuery) {
			return recentFilePaths.map((filePath) => {
				const title = getNoteTitle(filePath)
				const folder = folderFromPath(filePath, vault.path)
				return {
					type: "recent",
					value: `recent:${filePath}`,
					title,
					folder,
					filePath,
				}
			})
		}

		return searchResults.map((result) => {
			const folder = result.folder
			return {
				type: "search",
				value: `search:${result.id}`,
				title: result.title,
				folder,
				filePath: joinPath(vault.path, result.id),
				snippet: result.snippets[0],
			}
		})
	}, [recentFilePaths, searchResults, searchQuery, vault])

	const createItem = useMemo<QuickFinderCreateItem | null>(() => {
		if (!searchQuery || openItems.length > 0) return null
		return {
			type: "create",
			value: `create:${searchQuery}`,
			title: searchQuery,
			query: searchQuery,
		}
	}, [openItems.length, searchQuery])

	const displayItems = useMemo<QuickFinderItem[]>(() => {
		if (createItem) return [createItem]
		return openItems
	}, [createItem, openItems])

	if (selectionQuery !== searchQuery) {
		setSelectionQuery(searchQuery)
		setSelectedValue(displayItems[0]?.value ?? "")
	}

	const selectedItem =
		displayItems.find((item) => item.value === selectedValue) ?? displayItems[0] ?? null
	const selectedPreviewPath = selectedItem?.type === "create" ? null : selectedItem?.filePath

	const handleCreateNote = useCallback(
		async (noteTitle: string) => {
			if (!noteTitle.trim()) return
			const filePath = await createFile(vault.path, noteTitle.trim())
			openTab(filePath)
			toggleQuickFinder()
		},
		[vault, createFile, openTab, toggleQuickFinder],
	)

	const handleOpenItem = useCallback(
		(item: QuickFinderOpenItem, newTab = false, split = false) => {
			if (request.kind === "relink-bookmark") {
				void useBookmarksStore
					.getState()
					.renameBookmarkPath(vault.path, request.bookmarkPath, item.filePath)
			} else {
				openTab(item.filePath, buildOpenOptions(activePaneId, newTab, split))
			}
			toggleQuickFinder()
		},
		[activePaneId, openTab, request, toggleQuickFinder, vault.path],
	)

	const handleSelectItem = useCallback(
		(item: QuickFinderItem, newTab = false, split = false) => {
			if (item.type === "create") {
				void handleCreateNote(item.query)
				return
			}
			handleOpenItem(item, newTab, split)
		},
		[handleCreateNote, handleOpenItem],
	)

	const resultsPending = searchQuery !== trimmedQuery

	useEffect(() => {
		const pendingOpen = pendingOpenRef.current
		if (!pendingOpen || resultsPending) return
		pendingOpenRef.current = null
		const firstItem = displayItems[0]
		if (firstItem) handleSelectItem(firstItem, pendingOpen.newTab, pendingOpen.split)
	}, [displayItems, handleSelectItem, resultsPending])

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key !== "Enter") return

			const newTab = event.metaKey || event.ctrlKey
			if (event.shiftKey && !newTab) {
				event.preventDefault()
				void handleCreateNote(trimmedQuery)
				return
			}
			if (resultsPending) {
				event.preventDefault()
				pendingOpenRef.current = { newTab, split: newTab && event.shiftKey }
				return
			}
			if (!newTab) return

			const selectedItem =
				displayItems.find((item) => item.value === getSelectedCommandValue(event.currentTarget)) ??
				displayItems[0]
			if (!selectedItem) return

			event.preventDefault()
			handleSelectItem(selectedItem, newTab, newTab && event.shiftKey)
		},
		[displayItems, handleCreateNote, handleSelectItem, resultsPending, trimmedQuery],
	)

	return (
		<CommandDialog
			open
			onOpenChange={(open) => {
				if (!open) toggleQuickFinder()
			}}
			title="Quick Finder"
			description="Search and open files in your vault"
			className={
				preview ? "quick-finder-dialog quick-finder-dialog--preview" : "quick-finder-dialog"
			}
			showCloseButton={false}
			commandProps={{
				loop: true,
				shouldFilter: false,
				onKeyDown: handleKeyDown,
				value: selectedValue,
				onValueChange: setSelectedValue,
			}}
		>
			<CommandInput
				autoFocus
				placeholder={
					request.kind === "relink-bookmark" ? "Find the moved note..." : "Find or create a note..."
				}
				value={query}
				onValueChange={handleQueryChange}
				trailing={
					<>
						<Toggle
							size="sm"
							className="quick-finder-preview-toggle"
							aria-label="Show preview"
							title="Preview"
							pressed={preview}
							onPressedChange={(pressed) => useUIStore.getState().setQuickFinderPreview(pressed)}
						>
							<PanelRightIcon />
						</Toggle>
						<Kbd>Esc</Kbd>
					</>
				}
			/>
			<div className="quick-finder-body">
				<CommandList className="quick-finder-list">
					{displayItems.length === 0 ? (
						<CommandEmpty>No results found</CommandEmpty>
					) : (
						<CommandGroup>
							{displayItems.map((item) => {
								if (item.type === "create") {
									return (
										<CommandItem
											key={item.value}
											value={item.value}
											onSelect={() => handleSelectItem(item)}
										>
											<QuickFinderCreateRow item={item} />
										</CommandItem>
									)
								}

								return (
									<CommandItem
										key={item.value}
										value={item.value}
										onSelect={() => handleSelectItem(item)}
									>
										<QuickFinderOpenRow item={item} modifiedAt={modifiedTimes.get(item.filePath)} />
									</CommandItem>
								)
							})}
						</CommandGroup>
					)}
				</CommandList>
				{preview && selectedPreviewPath && (
					<QuickFinderPreview filePath={selectedPreviewPath} vaultPath={vault.path} />
				)}
			</div>
			<CommandFooterHints hints={QUICK_FINDER_FOOTER_HINTS} />
		</CommandDialog>
	)
}
