import { formatHotkeyDisplay } from "@cortex/commands/hotkeys"
import type { OpenTabOptions } from "@cortex/core"
import {
	formatRelativeTime,
	getNoteTitle,
	getParentPath,
	getRecentFilePaths,
	joinPath,
	selectActiveTabFilePath,
	toVaultRelativePath,
	useBookmarksStore,
	useUIStore,
	useVaultModifiedTimes,
	useVaultStore,
	useWorkspaceStore,
	type VaultMetadata,
} from "@cortex/core"
import {
	type SearchMatchRange,
	type SearchResult,
	type SearchSnippet,
	useSearchStore,
} from "@cortex/search"
import {
	CommandDialog,
	CommandFooterHints,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
	Kbd,
	SimpleTooltip,
	Toggle,
} from "@cortex/ui"
import { PanelRightIcon, PlusIcon } from "lucide-react"
import type { KeyboardEvent } from "react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback"
import { useMinuteNow } from "@/hooks/useMinuteNow"
import {
	openCommandPaletteFromQuickFinder,
	type QuickFinderRequest,
	quickFinderModal,
	toggleQuickFinder,
} from "@/utils/modals"
import { getFileKindIcon } from "../file-explorer/fileKindIcon"
import { HighlightedSnippet, HighlightedText } from "../search/HighlightedSnippet"
import { QuickFinderPreview } from "./QuickFinderPreview"
import { findTitleRanges, formatFolderLabel } from "./quickFinderText"

type QuickFinderSection = "recent" | "notes" | "text"

interface QuickFinderOpenItem {
	type: "open"
	section: QuickFinderSection
	value: string
	title: string
	titleRanges: readonly SearchMatchRange[]
	folder: string
	filePath: string
	snippet?: SearchSnippet
}

interface QuickFinderCreateItem {
	type: "create"
	value: string
	query: string
	standalone: boolean
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

const QUICK_FINDER_RESULT_LIMIT = 20
const CONTENT_SEARCH_DELAY_MS = 120
const MIN_CONTENT_QUERY_LENGTH = 3
const COMMANDS_PREFIX = ">"
const EMPTY_RESULTS: QuickFinderResults = { query: "", results: [] }

const SECTION_HEADINGS: Record<QuickFinderSection, string> = {
	recent: "Recent",
	notes: "Notes",
	text: "In text",
}

const QUICK_FINDER_FOOTER_HINTS = [
	{ keys: ["↵"], label: "Open" },
	{ keys: [formatHotkeyDisplay("mod"), "↵"], label: "New tab" },
	{ keys: [formatHotkeyDisplay("shift"), "↵"], label: "Create" },
	{ keys: [COMMANDS_PREFIX], label: "Commands", align: "end" as const },
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

function groupOpenItems(items: readonly QuickFinderOpenItem[]) {
	const groups: { section: QuickFinderSection; items: QuickFinderOpenItem[] }[] = []
	for (const item of items) {
		const last = groups.at(-1)
		if (last?.section === item.section) last.items.push(item)
		else groups.push({ section: item.section, items: [item] })
	}
	return groups
}

function QuickFinderOpenRow({
	item,
	when,
	showFolderColumn,
}: {
	item: QuickFinderOpenItem
	when: string
	showFolderColumn: boolean
}) {
	const Icon = getFileKindIcon(item.filePath)
	const folderLabel = formatFolderLabel(item.folder)
	return (
		<>
			<span className="quick-finder-icon" aria-hidden="true">
				<Icon />
			</span>
			<span className="quick-finder-copy">
				<span className="command-item-title">
					<HighlightedText text={item.title} ranges={item.titleRanges} />
				</span>
				{item.snippet ? (
					<span className="quick-finder-sub quick-finder-snippet">
						<HighlightedSnippet snippet={item.snippet} />
					</span>
				) : (
					folderLabel && <span className="quick-finder-sub">{folderLabel}</span>
				)}
			</span>
			{item.snippet && showFolderColumn && folderLabel && (
				<span className="quick-finder-folder">{folderLabel}</span>
			)}
			{when && <span className="quick-finder-when">{when}</span>}
		</>
	)
}

function QuickFinderCreateRow({
	item,
	folderLabel,
}: {
	item: QuickFinderCreateItem
	folderLabel: string
}) {
	return (
		<>
			<PlusIcon className="quick-finder-create-icon" aria-hidden="true" />
			<span className="command-item-title">Create “{item.query}”</span>
			{item.standalone && folderLabel && (
				<span className="quick-finder-create-folder">in {folderLabel}</span>
			)}
			<CommandShortcut>
				{item.standalone ? "↵" : `${formatHotkeyDisplay("shift")}↵`}
			</CommandShortcut>
		</>
	)
}

const QuickFinderRows = memo(function QuickFinderRows({
	openItems,
	createItem,
	activeFilePath,
	createFolderLabel,
	modifiedTimes,
	showFolderColumn,
	onSelect,
}: {
	openItems: QuickFinderOpenItem[]
	createItem: QuickFinderCreateItem | null
	activeFilePath: string | undefined
	createFolderLabel: string
	modifiedTimes: ReadonlyMap<string, number>
	showFolderColumn: boolean
	onSelect: (item: QuickFinderItem) => void
}) {
	const now = useMinuteNow()
	return (
		<>
			{groupOpenItems(openItems).map((group) => (
				<CommandGroup key={group.section} heading={SECTION_HEADINGS[group.section]}>
					{group.items.map((item) => (
						<CommandItem
							key={item.value}
							value={item.value}
							className="quick-finder-row"
							onSelect={() => onSelect(item)}
						>
							<QuickFinderOpenRow
								item={item}
								showFolderColumn={showFolderColumn}
								when={
									item.section === "recent" && item.filePath === activeFilePath
										? "Open"
										: formatRelativeTime(modifiedTimes.get(item.filePath), "short", now)
								}
							/>
						</CommandItem>
					))}
				</CommandGroup>
			))}
			{createItem && (
				<CommandGroup>
					<CommandItem
						value={createItem.value}
						className="quick-finder-create"
						onSelect={() => onSelect(createItem)}
					>
						<QuickFinderCreateRow item={createItem} folderLabel={createFolderLabel} />
					</CommandItem>
				</CommandGroup>
			)}
		</>
	)
})

export function QuickFinder() {
	const request = quickFinderModal.useTarget()
	const vault = useVaultStore((s) => s.vault)
	if (!request || !vault) return null
	return <QuickFinderDialog vault={vault} request={request} />
}

function QuickFinderDialog({
	vault,
	request,
}: {
	vault: VaultMetadata
	request: QuickFinderRequest
}) {
	const createFile = useVaultStore((s) => s.createFile)
	const openTab = useWorkspaceStore((s) => s.openTab)
	const panes = useWorkspaceStore((s) => s.panes)
	const recentlyClosed = useWorkspaceStore((s) => s.recentlyClosed)
	const activePaneId = useWorkspaceStore((s) => s.activePaneId)
	const activeFilePath = useWorkspaceStore(selectActiveTabFilePath)
	const preview = useUIStore((s) => s.quickFinderPreview)
	const indexing = useSearchStore((s) => s.indexing)
	const modifiedTimes = useVaultModifiedTimes()

	const [query, setQuery] = useState(() => request.query ?? "")
	const [selection, setSelection] = useState({ query: "", value: "" })
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
		if (trimmedQuery.length >= MIN_CONTENT_QUERY_LENGTH) loadContentResults(trimmedQuery)
	}, [indexing, loadContentResults, trimmedQuery])

	const handleQueryChange = (nextQuery: string) => {
		if (nextQuery.startsWith(COMMANDS_PREFIX) && request.kind === "open") {
			openCommandPaletteFromQuickFinder(nextQuery.slice(COMMANDS_PREFIX.length).trimStart())
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

	const openItems = useMemo<QuickFinderOpenItem[]>(() => {
		if (!searchQuery) {
			return recentFilePaths.map((filePath) => ({
				type: "open",
				section: "recent",
				value: `recent:${filePath}`,
				title: getNoteTitle(filePath),
				titleRanges: [],
				folder: folderFromPath(filePath, vault.path),
				filePath,
			}))
		}
		const titles = titleResults.results.slice(0, QUICK_FINDER_RESULT_LIMIT)
		const seen = new Set(titles.map((result) => result.id))
		const inText =
			contentResults.query === searchQuery
				? contentResults.results.filter(
						(result) => result.snippets.length > 0 && !seen.has(result.id),
					)
				: []
		const toItem = (result: SearchResult, section: QuickFinderSection): QuickFinderOpenItem => ({
			type: "open",
			section,
			value: `${section}:${result.id}`,
			title: result.title,
			titleRanges: section === "notes" ? findTitleRanges(result.title, searchQuery) : [],
			folder: result.folder,
			filePath: joinPath(vault.path, result.id),
			snippet: section === "text" ? result.snippets[0] : undefined,
		})
		return [
			...titles.map((result) => toItem(result, "notes")),
			...inText.map((result) => toItem(result, "text")),
		].slice(0, QUICK_FINDER_RESULT_LIMIT)
	}, [contentResults, recentFilePaths, searchQuery, titleResults, vault])

	const createItem = useMemo<QuickFinderCreateItem | null>(() => {
		if (!searchQuery || request.kind !== "open") return null
		const normalizedQuery = searchQuery.toLowerCase()
		if (openItems.some((item) => item.title.toLowerCase() === normalizedQuery)) return null
		return {
			type: "create",
			value: `create:${searchQuery}`,
			query: searchQuery,
			standalone: openItems.length === 0,
		}
	}, [openItems, request.kind, searchQuery])

	const displayItems = useMemo<QuickFinderItem[]>(
		() => (createItem ? [...openItems, createItem] : openItems),
		[createItem, openItems],
	)

	const selectedValue =
		selection.query === searchQuery ? selection.value : (displayItems[0]?.value ?? "")
	const handleSelectedValueChange = useCallback(
		(value: string) => setSelection({ query: searchQuery, value }),
		[searchQuery],
	)

	const selectedItem =
		displayItems.find((item) => item.value === selectedValue) ?? displayItems[0] ?? null
	const selectedPreviewPath = selectedItem?.type === "open" ? selectedItem.filePath : null

	const handleCreateNote = useCallback(
		async (noteTitle: string) => {
			if (!noteTitle.trim()) return
			const filePath = await createFile(vault.path, noteTitle.trim())
			openTab(filePath)
			toggleQuickFinder()
		},
		[vault, createFile, openTab],
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
		[activePaneId, openTab, request, vault.path],
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

	const showPreview = preview && selectedPreviewPath !== null

	return (
		<CommandDialog
			open
			onOpenChange={(open) => {
				if (!open) toggleQuickFinder()
			}}
			title="Quick Finder"
			description="Search and open files in your vault"
			className={
				showPreview ? "quick-finder-dialog quick-finder-dialog--preview" : "quick-finder-dialog"
			}
			showCloseButton={false}
			commandProps={{
				loop: true,
				shouldFilter: false,
				onKeyDown: handleKeyDown,
				value: selectedValue,
				onValueChange: handleSelectedValueChange,
			}}
		>
			<CommandInput
				autoFocus
				aria-label="Find a note"
				placeholder={
					request.kind === "relink-bookmark"
						? "Find the moved note..."
						: "Find a note, or type > for commands"
				}
				value={query}
				onValueChange={handleQueryChange}
				trailing={
					<>
						<SimpleTooltip label="Show preview">
							<Toggle
								size="sm"
								className="quick-finder-preview-toggle"
								aria-label="Show preview"
								pressed={preview}
								onPressedChange={(pressed) => useUIStore.getState().setQuickFinderPreview(pressed)}
							>
								<PanelRightIcon />
							</Toggle>
						</SimpleTooltip>
						<Kbd>Esc</Kbd>
					</>
				}
			/>
			<div className="quick-finder-body">
				<CommandList className="quick-finder-list">
					{openItems.length === 0 && searchQuery && (
						<div className="command-none">
							<strong>No notes called “{searchQuery}”</strong>
							<span>Nothing in titles or text either.</span>
						</div>
					)}
					<QuickFinderRows
						openItems={openItems}
						createItem={createItem}
						activeFilePath={activeFilePath}
						createFolderLabel={vault.name}
						modifiedTimes={modifiedTimes}
						showFolderColumn={!showPreview}
						onSelect={handleSelectItem}
					/>
				</CommandList>
				{preview && selectedPreviewPath && (
					<QuickFinderPreview
						filePath={selectedPreviewPath}
						vaultPath={vault.path}
						modifiedAt={modifiedTimes.get(selectedPreviewPath)}
					/>
				)}
			</div>
			<CommandFooterHints hints={QUICK_FINDER_FOOTER_HINTS} />
		</CommandDialog>
	)
}
