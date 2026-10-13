import {
	type SearchFilterKey,
	type SearchResult,
	tokenizeSearchQuery,
} from "@cortex/search"

export interface SearchFilter {
	key: SearchFilterKey
	value: string
}

export type SearchMode =
	| { kind: "results" }
	| { kind: "suggest"; operator: SearchFilterKey | null }
	| { kind: "values"; key: "path" | "tag"; prefix: string }

export interface SearchQueryState {
	filters: SearchFilter[]
	text: string
}

const COMPLETE_FILTER_PATTERN = /(tag|path|file):(\S+)\s/gi
const VALUE_PREFIX_PATTERN = /^(path|tag):(.*)$/i
const PARTIAL_OPERATOR_PATTERN = /^(p|pa|pat|path|t|ta|tag|f|fi|fil|file)$/i

export const SEARCH_OPERATORS: readonly { key: SearchFilterKey; label: string }[] = [
	{ key: "path", label: "Folder" },
	{ key: "file", label: "File name" },
	{ key: "tag", label: "Tag" },
]

export function formatFilter(filter: SearchFilter): string {
	return `${filter.key}:${filter.value}`
}

export function buildRawQuery(state: SearchQueryState): string {
	return [...state.filters.map(formatFilter), state.text.trim()].filter(Boolean).join(" ")
}

export function getActiveWord(text: string): string {
	return text.slice(text.search(/\S*$/))
}

export function extractCompleteFilters(
	filters: SearchFilter[],
	text: string,
): SearchQueryState {
	const nextFilters = [...filters]
	let changed = false
	const remaining = text.replace(COMPLETE_FILTER_PATTERN, (_match, key: string, value: string) => {
		const filter = { key: key.toLowerCase() as SearchFilterKey, value }
		if (!nextFilters.some((existing) => formatFilter(existing) === formatFilter(filter))) {
			nextFilters.push(filter)
		}
		changed = true
		return ""
	})
	if (!changed) return { filters, text }
	return { filters: nextFilters, text: remaining.replace(/\s{2,}/g, " ").trimStart() }
}

export function parseQueryState(raw: string): SearchQueryState {
	const filters: SearchFilter[] = []
	const textParts: string[] = []
	for (const token of tokenizeSearchQuery(raw)) {
		if (token.kind === "filter" && token.key) filters.push({ key: token.key, value: token.value })
		else textParts.push(token.value)
	}
	return { filters, text: textParts.join(" ") }
}

export function getSearchMode(state: SearchQueryState): SearchMode {
	const trimmed = state.text.trim()
	const activeWord = getActiveWord(state.text)
	const valueMatch = VALUE_PREFIX_PATTERN.exec(activeWord)
	if (valueMatch) {
		return {
			kind: "values",
			key: valueMatch[1].toLowerCase() as "path" | "tag",
			prefix: valueMatch[2],
		}
	}
	if (!trimmed) {
		return state.filters.length > 0 ? { kind: "results" } : { kind: "suggest", operator: null }
	}
	if (!/\s/.test(trimmed) && PARTIAL_OPERATOR_PATTERN.test(trimmed)) {
		const prefix = trimmed.toLowerCase()
		const operator = SEARCH_OPERATORS.find(({ key }) => key.startsWith(prefix))?.key ?? null
		return { kind: "suggest", operator }
	}
	return { kind: "results" }
}

export function formatResultsMeta(results: readonly SearchResult[], filters: SearchFilter[]): string {
	const matches = results.reduce((total, result) => total + result.matchCount, 0)
	const parts = [
		`${results.length} ${results.length === 1 ? "note" : "notes"}`,
		`${matches} ${matches === 1 ? "match" : "matches"}`,
	]
	const tags = filters.filter((filter) => filter.key === "tag").map((filter) => `#${filter.value}`)
	if (tags.length > 0) parts.push(`in ${tags.join(" ")}`)
	const paths = filters.filter((filter) => filter.key === "path").map((filter) => filter.value)
	if (paths.length > 0) parts.push(`in ${paths.join(", ")}`)
	return parts.join(" · ")
}
