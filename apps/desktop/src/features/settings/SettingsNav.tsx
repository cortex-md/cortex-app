import type { RegisteredSettingsPage } from "@cortex/plugin-host-core"
import { type SettingsSearchResult, searchSettings } from "@cortex/settings"
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	LucideIcon,
	SidebarNav,
	SidebarNavGroup,
	SidebarNavItem,
} from "@cortex/ui"
import { Blocks, LayoutTemplate, SearchIcon } from "lucide-react"
import { type ComponentType, useEffect, useMemo, useRef, useState } from "react"
import {
	getSettingsSearchOptionId,
	orderResultsByPage,
	SETTINGS_SEARCH_LISTBOX_ID,
	SettingsSearchResults,
} from "./SettingsSearchResults"
import type { SettingsNavigateHandler } from "./SettingsView"
import { useSettingsSearchItems } from "./useSettingsSearchItems"

interface SettingsNavProps {
	pages: RegisteredSettingsPage[]
	activeKey: string
	onNavigate: SettingsNavigateHandler
}

function groupSettingsPages(pages: RegisteredSettingsPage[]) {
	const groups = new Map<string, RegisteredSettingsPage[]>()
	for (const page of pages) {
		const group = groups.get(page.group)
		if (group) group.push(page)
		else groups.set(page.group, [page])
	}
	return Array.from(groups, ([label, groupPages]) => ({ label, pages: groupPages }))
}

function SettingsPageIcon({ icon }: { icon: RegisteredSettingsPage["icon"] | undefined }) {
	if (!icon) return null
	if (typeof icon === "string") return <LucideIcon name={icon} size={16} />
	const Icon = icon as ComponentType
	return <Icon />
}

function isTypingTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
	)
}

function useSearchShortcut(inputRef: React.RefObject<HTMLInputElement | null>): void {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const commandKey = (event.metaKey || event.ctrlKey) && ["f", "k"].includes(event.key)
			const slashKey = event.key === "/" && !isTypingTarget(event.target)
			if (!commandKey && !slashKey) return
			event.preventDefault()
			inputRef.current?.focus()
			inputRef.current?.select()
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [inputRef])
}

export function SettingsNav({ pages, activeKey, onNavigate }: SettingsNavProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [query, setQuery] = useState("")
	const [selection, setSelection] = useState({ query: "", index: 0 })
	const items = useSettingsSearchItems(pages)
	const results = useMemo(() => orderResultsByPage(searchSettings(items, query)), [items, query])
	const pagesByKey = useMemo(() => new Map(pages.map((page) => [page.key, page])), [pages])
	const selectedIndex = selection.query === query ? selection.index : 0
	const searching = query.trim().length > 0
	useSearchShortcut(inputRef)

	const openResult = (result: SettingsSearchResult, focus: boolean) => {
		const fieldId = result.item.kind === "page" ? undefined : result.item.id
		onNavigate(result.item.pageKey, fieldId, focus, result.item.fallbackId)
	}

	const moveSelection = (delta: number) => {
		if (results.length === 0) return
		const index = (selectedIndex + delta + results.length) % results.length
		setSelection({ query, index })
		const result = results[index]
		if (result) openResult(result, false)
	}

	const renderIcon = (result: SettingsSearchResult) => {
		if (result.item.kind === "plugin") return <Blocks />
		if (result.item.kind === "template") return <LayoutTemplate />
		return <SettingsPageIcon icon={pagesByKey.get(result.item.pageKey)?.icon} />
	}

	return (
		<SidebarNav aria-label="Settings sections" className="settings-sidebar">
			<InputGroup variant="search" className="settings-nav-search" aria-label="Search settings">
				<InputGroupAddon>
					<SearchIcon />
				</InputGroupAddon>
				<InputGroupInput
					ref={inputRef}
					value={query}
					placeholder="Search settings"
					role="combobox"
					aria-expanded={searching}
					aria-controls={SETTINGS_SEARCH_LISTBOX_ID}
					aria-activedescendant={
						searching && results.length > 0 ? getSettingsSearchOptionId(selectedIndex) : undefined
					}
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "ArrowDown" || event.key === "ArrowUp") {
							event.preventDefault()
							moveSelection(event.key === "ArrowDown" ? 1 : -1)
						} else if (event.key === "Enter") {
							const result = results[selectedIndex]
							if (result) openResult(result, true)
						} else if (event.key === "Escape" && query) {
							event.preventDefault()
							setQuery("")
						}
					}}
				/>
			</InputGroup>
			{searching ? (
				<SettingsSearchResults
					query={query.trim()}
					results={results}
					selectedIndex={selectedIndex}
					getGroupLabel={(pageKey) => pagesByKey.get(pageKey)?.label ?? pageKey}
					renderIcon={renderIcon}
					onHover={(index) => setSelection({ query, index })}
					onOpen={(result) => openResult(result, true)}
				/>
			) : (
				groupSettingsPages(pages).map((group) => (
					<SidebarNavGroup key={group.label} label={group.label}>
						{group.pages.map((page) => (
							<SidebarNavItem
								key={page.key}
								onClick={() => onNavigate(page.key)}
								isActive={activeKey === page.key}
							>
								<SettingsPageIcon icon={page.icon} />
								<span>{page.label}</span>
							</SidebarNavItem>
						))}
					</SidebarNavGroup>
				))
			)}
		</SidebarNav>
	)
}
