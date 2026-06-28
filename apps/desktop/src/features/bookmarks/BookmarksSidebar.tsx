import {
	type BookmarkEntry,
	getNotePathPresentation,
	resolveBookmarkPath,
	useBookmarksStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import {
	Button,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@cortex/ui"
import { BookmarkIcon, SearchIcon } from "lucide-react"
import { type ChangeEvent, useCallback, useDeferredValue, useMemo, useState } from "react"

interface BookmarkRowModel {
	bookmark: BookmarkEntry
	filePath: string
	title: string
	missing: boolean
	active: boolean
}

interface BookmarkRowProps {
	row: BookmarkRowModel
	onOpen: (filePath: string) => void
	onRemove: (path: string) => void
}

function getBookmarkTitle(filePath: string, vaultPath: string) {
	return getNotePathPresentation(filePath, vaultPath).title
}

function BookmarkRow({ row, onOpen, onRemove }: BookmarkRowProps) {
	const missingLabel = row.missing ? "Not found" : null

	return (
		<div
			className={`sidebar-bookmark-row${row.active ? " active" : ""}`}
			data-missing={row.missing ? "true" : "false"}
		>
			<button
				type="button"
				className="sidebar-bookmark-open"
				disabled={row.missing}
				onClick={() => onOpen(row.filePath)}
				aria-label={`Open ${row.title}`}
				title={row.missing ? "This note is no longer in the vault" : row.filePath}
			>
				<span className="sidebar-bookmark-title">{row.title}</span>
				{missingLabel && <span className="sidebar-bookmark-status">{missingLabel}</span>}
			</button>
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

export function BookmarksSidebar() {
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const bookmarks = useBookmarksStore((state) => state.bookmarks)
	const removeBookmark = useBookmarksStore((state) => state.removeBookmark)
	const openTab = useWorkspaceStore((state) => state.openTab)
	const activeFilePath = useWorkspaceStore((state) => {
		const activePane = state.panes[state.activePaneId]
		const activeTab = activePane?.tabs.find((tab) => tab.id === activePane.activeTabId)
		return activeTab?.filePath
	})
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
			const title = getBookmarkTitle(filePath, vault.path)
			const searchable = `${title}\n${bookmark.path}`.toLocaleLowerCase()
			if (query && !searchable.includes(query)) return []
			return [
				{
					bookmark,
					filePath,
					title,
					missing: !filePaths.has(filePath),
					active: filePath === activeFilePath,
				},
			]
		})
	}, [activeFilePath, bookmarks, deferredFilterQuery, filePaths, vault])

	const handleOpen = useCallback(
		(filePath: string) => {
			openTab(filePath)
		},
		[openTab],
	)

	const handleRemove = useCallback(
		(path: string) => {
			if (!vault) return
			void removeBookmark(vault.path, path)
		},
		[removeBookmark, vault],
	)

	if (!vault) {
		return <div className="sidebar-tool-empty">No vault open</div>
	}

	const bookmarkCountLabel =
		bookmarks.length === 0
			? "No bookmarks"
			: `${bookmarks.length} bookmark${bookmarks.length !== 1 ? "s" : ""}`

	return (
		<TooltipProvider delayDuration={320}>
			<div className="sidebar-bookmarks-view">
				<div className="sidebar-tool-header">
					<InputGroup variant="search" aria-label="Filter bookmarks">
						<InputGroupAddon>
							<SearchIcon />
						</InputGroupAddon>
						<InputGroupInput
							type="text"
							value={filterQuery}
							onChange={(event: ChangeEvent<HTMLInputElement>) =>
								setFilterQuery(event.target.value)
							}
							placeholder="Filter bookmarks..."
						/>
					</InputGroup>
					<div className="sidebar-tool-meta-row">
						<span className="sidebar-tool-count">{bookmarkCountLabel}</span>
					</div>
				</div>

				<div className="sidebar-tool-scroll">
					{rows.length === 0 ? (
						<div className="sidebar-tool-empty sidebar-tool-empty-stacked">
							<BookmarkIcon className="size-6 text-muted-foreground/50" />
							<p className="text-xs text-muted-foreground">
								{filterQuery ? "No bookmarks match your filter" : "No bookmarks yet"}
							</p>
							{filterQuery ? (
								<Button
									variant="ghost"
									size="sm"
									className="h-7 text-xs"
									onClick={() => setFilterQuery("")}
								>
									Clear filter
								</Button>
							) : (
								<p className="max-w-44 text-[10px] leading-4 text-muted-foreground/70">
									Use Add Bookmark from a note menu or press ⌘⇧B on the active note.
								</p>
							)}
						</div>
					) : (
						<div className="sidebar-bookmarks-list">
							{rows.map((row) => (
								<BookmarkRow
									key={row.bookmark.path}
									row={row}
									onOpen={handleOpen}
									onRemove={handleRemove}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</TooltipProvider>
	)
}
