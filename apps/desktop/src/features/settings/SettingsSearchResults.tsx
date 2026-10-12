import type { SettingsSearchResult } from "@cortex/settings"
import { type ReactNode, useEffect, useRef } from "react"
import { HighlightedSnippet } from "../search/HighlightedSnippet"

export const SETTINGS_SEARCH_LISTBOX_ID = "settings-search-results"

export function getSettingsSearchOptionId(index: number): string {
	return `${SETTINGS_SEARCH_LISTBOX_ID}-${index}`
}

interface SettingsSearchResultsProps {
	query: string
	results: SettingsSearchResult[]
	selectedIndex: number
	getGroupLabel: (pageKey: string) => string
	renderIcon: (result: SettingsSearchResult) => ReactNode
	onHover: (index: number) => void
	onOpen: (result: SettingsSearchResult) => void
}

interface ResultGroup {
	pageKey: string
	entries: { result: SettingsSearchResult; index: number }[]
}

function groupResults(results: SettingsSearchResult[]): ResultGroup[] {
	const groups = new Map<string, ResultGroup>()
	results.forEach((result, index) => {
		const pageKey = result.item.pageKey
		const group = groups.get(pageKey) ?? { pageKey, entries: [] }
		group.entries.push({ result, index })
		groups.set(pageKey, group)
	})
	return [...groups.values()]
}

export function orderResultsByPage(results: SettingsSearchResult[]): SettingsSearchResult[] {
	return groupResults(results).flatMap((group) => group.entries.map(({ result }) => result))
}

function resultDetail(result: SettingsSearchResult): string | undefined {
	if (result.item.kind === "page") return result.item.description
	return result.item.path.slice(1).join(" › ") || result.item.description
}

export function SettingsSearchResults({
	query,
	results,
	selectedIndex,
	getGroupLabel,
	renderIcon,
	onHover,
	onOpen,
}: SettingsSearchResultsProps) {
	const listRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		listRef.current
			?.querySelector(`#${getSettingsSearchOptionId(selectedIndex)}`)
			?.scrollIntoView({ block: "nearest" })
	}, [selectedIndex])

	if (results.length === 0) {
		return (
			<div className="settings-search-empty">
				<p>No settings match “{query}”.</p>
				<span>Try “font”, “sync”, or “vim”.</span>
			</div>
		)
	}

	return (
		<div
			ref={listRef}
			id={SETTINGS_SEARCH_LISTBOX_ID}
			role="listbox"
			aria-label="Settings search results"
			className="settings-search-results"
		>
			<div className="settings-search-count">
				{results.length} {results.length === 1 ? "result" : "results"}
			</div>
			{groupResults(results).map((group) => (
				<div key={group.pageKey} className="settings-search-group">
					<div className="settings-search-group-label">{getGroupLabel(group.pageKey)}</div>
					{group.entries.map(({ result, index }) => {
						const detail = resultDetail(result)
						return (
							<div
								key={result.item.id}
								id={getSettingsSearchOptionId(index)}
								role="option"
								tabIndex={-1}
								aria-selected={index === selectedIndex}
								className="settings-search-option"
								onMouseEnter={() => onHover(index)}
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => onOpen(result)}
								onKeyDown={(event) => {
									if (event.key === "Enter") onOpen(result)
								}}
							>
								<span className="settings-search-option-icon">{renderIcon(result)}</span>
								<span className="settings-search-option-copy">
									<span className="settings-search-option-label">
										<HighlightedSnippet
											snippet={{
												text: result.item.label,
												ranges: result.labelRanges.map(({ start, end }) => [start, end] as const),
											}}
											markClassName="settings-search-mark"
										/>
									</span>
									{detail && <span className="settings-search-option-detail">{detail}</span>}
								</span>
							</div>
						)
					})}
				</div>
			))}
		</div>
	)
}
