import type { FolderNoteCount } from "@cortex/core"
import {
	getSearchSuggestions,
	removeSearchQueryToken,
	type SearchQueryToken,
	tokenizeSearchQuery,
} from "@cortex/search"
import {
	Button,
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	Kbd,
} from "@cortex/ui"
import { ClockIcon, FolderIcon, HashIcon, SearchIcon, XIcon } from "lucide-react"
import { type KeyboardEvent, type Ref, useMemo, useState } from "react"

interface SearchQueryFieldProps {
	inputRef: Ref<HTMLInputElement>
	value: string
	folders: readonly FolderNoteCount[]
	tags: ReadonlyArray<{ tag: string; count: number }>
	recentQueries: readonly string[]
	onChange: (value: string) => void
	onSubmit: (value: string) => void
}

function splitCommittedTokens(value: string): { chips: SearchQueryToken[]; draft: string } {
	const chips = tokenizeSearchQuery(value).filter(
		(token) => token.kind === "filter" && token.end < value.length,
	)
	let draft = value
	for (const chip of [...chips].reverse()) draft = removeSearchQueryToken(draft, chip)
	return { chips, draft: draft.trimStart() }
}

function joinQuery(chips: readonly SearchQueryToken[], draft: string): string {
	const filters = chips.map((chip) => `${chip.key}:${chip.value}`).join(" ")
	return filters ? `${filters} ${draft}` : draft
}

function suggestionIcon(kind: string, label: string) {
	if (kind === "recent") return <ClockIcon aria-hidden="true" />
	if (label.startsWith("#") || label.startsWith("tag:")) return <HashIcon aria-hidden="true" />
	if (label.startsWith("path:") || kind === "value") return <FolderIcon aria-hidden="true" />
	return <SearchIcon aria-hidden="true" />
}

export function SearchQueryField({
	inputRef,
	value,
	folders,
	tags,
	recentQueries,
	onChange,
	onSubmit,
}: SearchQueryFieldProps) {
	const [focused, setFocused] = useState(false)
	const [highlighted, setHighlighted] = useState(-1)
	const { chips, draft } = splitCommittedTokens(value)
	const suggestions = useMemo(
		() => getSearchSuggestions(value, { folders, tags, recent: recentQueries }),
		[folders, recentQueries, tags, value],
	)
	const showSuggestions = focused && suggestions.length > 0

	const applySuggestion = (insert: string) => {
		onChange(insert)
		setHighlighted(-1)
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Backspace" && draft.length === 0 && chips.length > 0) {
			event.preventDefault()
			onChange(joinQuery(chips.slice(0, -1), ""))
			return
		}
		if (!showSuggestions) {
			if (event.key === "Enter") onSubmit(value)
			return
		}
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault()
			const step = event.key === "ArrowDown" ? 1 : -1
			setHighlighted((current) => (current + step + suggestions.length) % suggestions.length)
			return
		}
		if (event.key === "Tab" || (event.key === "Enter" && highlighted >= 0)) {
			event.preventDefault()
			applySuggestion(suggestions[Math.max(0, highlighted)].insert)
			return
		}
		if (event.key === "Enter") onSubmit(value)
		if (event.key === "Escape") setFocused(false)
	}

	return (
		<div className="search-query-field">
			<InputGroup variant="search" className="sidebar-tool-field" aria-label="Search notes">
				<InputGroupAddon>
					<SearchIcon />
				</InputGroupAddon>
				{chips.map((chip) => (
					<span key={`${chip.start}:${chip.key}:${chip.value}`} className="search-query-token">
						<b>{chip.key}:</b>
						{chip.value}
						<Button
							variant="ghost"
							size="icon-xs"
							className="search-query-token-remove"
							aria-label={`Remove ${chip.key}:${chip.value} filter`}
							onClick={() =>
								onChange(
									joinQuery(
										chips.filter((candidate) => candidate !== chip),
										draft,
									),
								)
							}
						>
							<XIcon />
						</Button>
					</span>
				))}
				<InputGroupInput
					ref={inputRef}
					type="text"
					value={draft}
					placeholder={chips.length > 0 ? "" : "Search in vault..."}
					onChange={(event) => {
						setHighlighted(-1)
						onChange(joinQuery(chips, event.target.value))
					}}
					onKeyDown={handleKeyDown}
					onFocus={() => setFocused(true)}
					onBlur={() => setFocused(false)}
				/>
				{value && (
					<InputGroupAddon align="inline-end">
						<InputGroupButton
							size="icon-xs"
							className="search-query-clear"
							aria-label="Clear search"
							onClick={() => onChange("")}
						>
							<XIcon />
						</InputGroupButton>
					</InputGroupAddon>
				)}
			</InputGroup>
			{showSuggestions && (
				<div className="search-suggestions" role="listbox" aria-label="Search suggestions">
					{suggestions.map((suggestion, index) => (
						<Button
							key={`${suggestion.kind}:${suggestion.label}`}
							variant="ghost"
							role="option"
							aria-selected={index === highlighted}
							className="search-suggestion"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => applySuggestion(suggestion.insert)}
						>
							{suggestionIcon(suggestion.kind, suggestion.label)}
							<span className="search-suggestion-label">{suggestion.label}</span>
							<span className="search-suggestion-detail">{suggestion.detail}</span>
						</Button>
					))}
					<div className="search-suggestions-hint">
						<Kbd>Tab</Kbd> complete <Kbd>↵</Kbd> search
					</div>
				</div>
			)}
		</div>
	)
}
