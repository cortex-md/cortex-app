import {
	type BookmarkEntry,
	resolveBookmarkPath,
	selectActiveTabFilePath,
	useBookmarksStore,
	useUIStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cortex/ui"
import { BookmarkIcon, FileTextIcon, GripVerticalIcon, SearchIcon } from "lucide-react"
import { useCallback, useDeferredValue, useMemo, useState } from "react"
import { useCommandHotkey } from "@/hooks/useCommandHotkey"
import { formatCount } from "@/utils/format"
import { SidebarNoVaultState, SidebarToolView } from "../sidebar/SidebarToolView"
import { getSidebarNotePresentation } from "../sidebar/sidebarNotePresentation"
import { type SortableItemProps, useSortableList } from "../sidebar/useSortableList"

const BOOKMARK_TOGGLE_COMMAND_ID = "bookmarks.toggle"

interface BookmarkRowModel {
	bookmark: BookmarkEntry
	filePath: string
	title: string
	folder: string
	missing: boolean
	active: boolean
}

interface BookmarkRowProps {
	row: BookmarkRowModel
	sortableProps?: SortableItemProps
	onOpen: (filePath: string) => void
	onRemove: (path: string) => void
}

function findMovedNote(row: BookmarkRowModel) {
	useUIStore.getState().openQuickFinder({
		kind: "relink-bookmark",
		bookmarkPath: row.filePath,
		query: row.title,
	})
}

function BookmarkRow({ row, sortableProps, onOpen, onRemove }: BookmarkRowProps) {
	return (
		<div
			className={`sidebar-bookmark-row${row.active ? " active" : ""}`}
			data-missing={row.missing ? "true" : "false"}
			{...sortableProps}
		>
			{sortableProps && (
				<span className="sidebar-bookmark-grip" aria-hidden="true">
					<GripVerticalIcon />
				</span>
			)}
			<Button
				variant="ghost"
				className="sidebar-bookmark-open"
				disabled={row.missing}
				onClick={() => onOpen(row.filePath)}
				aria-label={`Open ${row.title}`}
				title={row.missing ? "This note is no longer in the vault" : row.filePath}
			>
				<FileTextIcon className="sidebar-bookmark-icon" aria-hidden="true" />
				<span className="sidebar-bookmark-copy">
					<span className="sidebar-bookmark-title">{row.title}</span>
					{row.missing ? (
						<span className="sidebar-bookmark-status">Moved or deleted</span>
					) : (
						row.folder && <span className="sidebar-bookmark-path">{row.folder}</span>
					)}
				</span>
			</Button>
			{row.missing && (
				<span className="sidebar-bookmark-fix">
					<Button variant="secondary" size="xs" onClick={() => findMovedNote(row)}>
						Find note
					</Button>
					<Button variant="ghost" size="xs" onClick={() => onRemove(row.bookmark.path)}>
						Remove
					</Button>
				</span>
			)}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						className="sidebar-bookmark-action"
						onClick={() => onRemove(row.bookmark.path)}
						aria-label={`Remove ${row.title} from bookmarks`}
					>
						<BookmarkIcon className="sidebar-bookmark-remove-icon" aria-hidden="true" />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="left" sideOffset={6}>
					Remove bookmark
				</TooltipContent>
			</Tooltip>
		</div>
	)
}

function getBookmarkHint(hotkey: string | null): string {
	const base = "Use Add Bookmark from a note menu"
	return hotkey ? `${base} or press ${hotkey} on the active note.` : `${base}.`
}

export function BookmarksSidebar() {
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const bookmarks = useBookmarksStore((state) => state.bookmarks)
	const removeBookmark = useBookmarksStore((state) => state.removeBookmark)
	const openTab = useWorkspaceStore((state) => state.openTab)
	const activeFilePath = useWorkspaceStore(selectActiveTabFilePath)
	const toggleBookmarkHotkey = useCommandHotkey(BOOKMARK_TOGGLE_COMMAND_ID)
	const [filterQuery, setFilterQuery] = useState("")
	const deferredFilterQuery = useDeferredValue(filterQuery)

	const filePaths = useMemo(
		() => new Set(files.flatMap((file) => (file.isDir ? [] : [file.path]))),
		[files],
	)

	const rows = useMemo(() => {
		if (!vault) return []
		const query = deferredFilterQuery.trim().toLocaleLowerCase()
		return bookmarks.flatMap((bookmark) => {
			const filePath = resolveBookmarkPath(vault.path, bookmark.path)
			const { title, folder } = getSidebarNotePresentation(filePath, vault.path)
			const searchable = `${title}\n${bookmark.path}`.toLocaleLowerCase()
			if (query && !searchable.includes(query)) return []
			return [
				{
					bookmark,
					filePath,
					title,
					folder,
					missing: !filePaths.has(filePath),
					active: filePath === activeFilePath,
				},
			]
		})
	}, [activeFilePath, bookmarks, deferredFilterQuery, filePaths, vault])

	const handleRemove = useCallback(
		(path: string) => {
			if (!vault) return
			void removeBookmark(vault.path, path)
		},
		[removeBookmark, vault],
	)

	const reorderable = !deferredFilterQuery.trim() && rows.length > 1
	const handleReorder = useCallback(
		(fromIndex: number, toIndex: number) => {
			const row = rows[fromIndex]
			if (vault && row) {
				void useBookmarksStore.getState().reorderBookmark(vault.path, row.bookmark.path, toIndex)
			}
		},
		[rows, vault],
	)
	const sortable = useSortableList(rows.length, handleReorder)

	if (!vault) return <SidebarNoVaultState />

	return (
		<TooltipProvider delayDuration={320}>
			<SidebarToolView
				title="Bookmarks"
				filterLabel="Filter bookmarks"
				filterIcon={<SearchIcon />}
				filterPlaceholder="Filter bookmarks..."
				filterValue={filterQuery}
				onFilterChange={setFilterQuery}
				count={bookmarks.length === 0 ? "No bookmarks" : formatCount(bookmarks.length, "bookmark")}
				meta={reorderable && <span className="sidebar-tool-filters">Drag to reorder</span>}
				empty={
					rows.length === 0
						? {
								icon: <BookmarkIcon className="size-6 text-muted-foreground" />,
								message: filterQuery ? "No bookmarks match your filter" : "No bookmarks yet",
								description: getBookmarkHint(toggleBookmarkHotkey),
								clearable: Boolean(filterQuery),
							}
						: null
				}
			>
				<div
					ref={sortable.listRef}
					className="sidebar-tool-list"
					role="tree"
					aria-label="Bookmarks"
				>
					{rows.map((row, index) => (
						<BookmarkRow
							key={row.bookmark.path}
							row={row}
							sortableProps={reorderable ? sortable.getItemProps(index) : undefined}
							onOpen={openTab}
							onRemove={handleRemove}
						/>
					))}
				</div>
			</SidebarToolView>
		</TooltipProvider>
	)
}
