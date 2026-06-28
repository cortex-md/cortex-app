import type { OpenTabOptions } from "@cortex/core"
import { useUIStore, useVaultStore, useWorkspaceStore } from "@cortex/core"
import { useSearchStore } from "@cortex/search"
import {
	CommandDialog,
	CommandEmpty,
	CommandFooter,
	CommandFooterHint,
	CommandFooterKey,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@cortex/ui"
import type { KeyboardEvent } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"

interface QuickFinderOpenItem {
	type: "recent" | "search"
	value: string
	title: string
	displayTitle: string
	folder: string
	filePath: string
}

interface QuickFinderCreateItem {
	type: "create"
	value: string
	title: string
	query: string
}

type QuickFinderItem = QuickFinderOpenItem | QuickFinderCreateItem

const QUICK_FINDER_FOOTER_HINTS = [
	{ keys: ["↑", "↓"], label: "navigate" },
	{ keys: ["Return"], label: "open" },
	{ keys: ["⌘", "Return"], label: "new tab" },
	{ keys: ["⌘", "⇧", "Return"], label: "open right" },
	{ keys: ["⇧", "Return"], label: "create" },
	{ keys: ["Esc"], label: "close" },
]

function titleFromPath(filePath: string): string {
	const name = filePath.split("/").pop() ?? filePath
	return name.endsWith(".md") ? name.slice(0, -3) : name
}

function folderFromPath(filePath: string, vaultPath: string): string {
	const relativePath = filePath.startsWith(vaultPath) ? filePath.slice(vaultPath.length) : filePath
	const folderParts = relativePath.split("/").filter(Boolean)
	folderParts.pop()
	return folderParts.join("/")
}

function formatDisplayTitle(title: string, folder: string): string {
	if (!folder) return title
	return `${folder} /${title}`
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

function QuickFinderOpenRow({ item }: { item: QuickFinderOpenItem }) {
	return (
		<span className="command-item-copy">
			<span className="command-item-title">{item.displayTitle}</span>
		</span>
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
	const toggleQuickFinder = useUIStore((s) => s.toggleQuickFinder)
	const vault = useVaultStore((s) => s.vault)
	const createFile = useVaultStore((s) => s.createFile)
	const openTab = useWorkspaceStore((s) => s.openTab)
	const panes = useWorkspaceStore((s) => s.panes)
	const recentlyClosed = useWorkspaceStore((s) => s.recentlyClosed)
	const activePaneId = useWorkspaceStore((s) => s.activePaneId)
	const searchTitles = useSearchStore((s) => s.searchTitles)

	const [query, setQuery] = useState("")

	const trimmedQuery = query.trim()

	const recentFilePaths = useMemo(() => {
		const paths: string[] = []
		const pathSet = new Set<string>()
		for (const pane of Object.values(panes)) {
			for (const tab of [...pane.tabs].sort((a, b) => b.lastAccessed - a.lastAccessed)) {
				if (!pathSet.has(tab.filePath)) {
					pathSet.add(tab.filePath)
					paths.push(tab.filePath)
				}
			}
		}
		for (const closed of recentlyClosed) {
			if (!pathSet.has(closed.filePath)) {
				pathSet.add(closed.filePath)
				paths.push(closed.filePath)
			}
		}
		return paths.slice(0, 15)
	}, [panes, recentlyClosed])

	const searchResults = useMemo(() => {
		if (!trimmedQuery) return []
		return searchTitles(trimmedQuery).slice(0, 20)
	}, [trimmedQuery, searchTitles])

	const openItems = useMemo<QuickFinderOpenItem[]>(() => {
		if (!vault) return []

		if (!trimmedQuery) {
			return recentFilePaths.map((filePath) => {
				const title = titleFromPath(filePath)
				const folder = folderFromPath(filePath, vault.path)
				return {
					type: "recent",
					value: `recent:${filePath}`,
					title,
					displayTitle: formatDisplayTitle(title, folder),
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
				displayTitle: formatDisplayTitle(result.title, folder),
				folder,
				filePath: `${vault.path}/${result.id}`,
			}
		})
	}, [recentFilePaths, searchResults, trimmedQuery, vault])

	const createItem = useMemo<QuickFinderCreateItem | null>(() => {
		if (!trimmedQuery || openItems.length > 0) return null
		return {
			type: "create",
			value: `create:${trimmedQuery}`,
			title: trimmedQuery,
			query: trimmedQuery,
		}
	}, [openItems.length, trimmedQuery])

	const displayItems = useMemo<QuickFinderItem[]>(() => {
		if (createItem) return [createItem]
		return openItems
	}, [createItem, openItems])

	useEffect(() => {
		if (quickFinderOpen) {
			setQuery("")
		}
	}, [quickFinderOpen])

	const handleCreateNote = useCallback(
		async (noteTitle: string) => {
			if (!vault || !noteTitle.trim()) return
			const filePath = await createFile(vault.path, noteTitle.trim())
			openTab(filePath)
			toggleQuickFinder()
		},
		[vault, createFile, openTab, toggleQuickFinder],
	)

	const handleOpenItem = useCallback(
		(item: QuickFinderOpenItem, newTab = false, split = false) => {
			openTab(item.filePath, buildOpenOptions(activePaneId, newTab, split))
			toggleQuickFinder()
		},
		[activePaneId, openTab, toggleQuickFinder],
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

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key !== "Enter") return

			const newTab = event.metaKey || event.ctrlKey
			if (event.shiftKey && !newTab) {
				event.preventDefault()
				void handleCreateNote(trimmedQuery)
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
		[displayItems, handleCreateNote, handleSelectItem, trimmedQuery],
	)

	if (!vault) return null

	return (
		<CommandDialog
			open={quickFinderOpen}
			onOpenChange={(open) => {
				if (!open) toggleQuickFinder()
			}}
			title="Quick Finder"
			description="Search and open files in your vault"
			className="quick-finder-dialog sm:max-w-[760px]"
			commandProps={{
				loop: true,
				shouldFilter: false,
				onKeyDown: handleKeyDown,
			}}
		>
			<CommandInput
				autoFocus
				placeholder="Find or create a note..."
				value={query}
				onValueChange={setQuery}
			/>
			<CommandList className="max-h-[min(430px,62vh)]">
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
									<QuickFinderOpenRow item={item} />
								</CommandItem>
							)
						})}
					</CommandGroup>
				)}
			</CommandList>
			<CommandFooter>
				{QUICK_FINDER_FOOTER_HINTS.map((hint) => (
					<CommandFooterHint key={`${hint.keys.join("-")}-${hint.label}`}>
						{hint.keys.map((key) => (
							<CommandFooterKey key={key}>{key}</CommandFooterKey>
						))}
						{hint.label}
					</CommandFooterHint>
				))}
			</CommandFooter>
		</CommandDialog>
	)
}
