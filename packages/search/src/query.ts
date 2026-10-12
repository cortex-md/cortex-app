import type { SearchOptions } from "./types"

export interface ParsedSearchQuery {
	text: string
	tags: string[]
	paths: string[]
	files: string[]
}

export interface SearchRequest {
	text: string
	options: SearchOptions
}

const SEARCH_FILTER_PATTERN = /(tag|path|file):(\S+)/gi

export function parseSearchQuery(raw: string): ParsedSearchQuery {
	const result: ParsedSearchQuery = { text: "", tags: [], paths: [], files: [] }
	const textParts: string[] = []
	let lastIndex = 0
	for (const match of raw.matchAll(SEARCH_FILTER_PATTERN)) {
		const matchIndex = match.index ?? 0
		if (matchIndex > lastIndex) textParts.push(raw.slice(lastIndex, matchIndex))
		const prefix = match[1].toLowerCase()
		if (prefix === "tag") result.tags.push(match[2])
		else if (prefix === "path") result.paths.push(match[2])
		else result.files.push(match[2])
		lastIndex = matchIndex + match[0].length
	}
	if (lastIndex < raw.length) textParts.push(raw.slice(lastIndex))
	result.text = textParts.join("").trim()
	return result
}

export function hasSearchFilters(parsed: ParsedSearchQuery): boolean {
	return parsed.tags.length > 0 || parsed.paths.length > 0 || parsed.files.length > 0
}

export function formatSearchFilterSummary(parsed: ParsedSearchQuery): string {
	return [
		...parsed.tags.map((tag) => `tag:${tag}`),
		...parsed.paths.map((path) => `path:${path}`),
		...parsed.files.map((file) => `file:${file}`),
	].join(" ")
}

export function toSearchRequest(parsed: ParsedSearchQuery): SearchRequest | null {
	if (!parsed.text && !hasSearchFilters(parsed)) return null
	const text =
		parsed.text || parsed.files.join(" ") || parsed.tags.join(" ") || parsed.paths.join(" ") || " "
	return {
		text,
		options: {
			tags: parsed.tags.length > 0 ? parsed.tags : undefined,
			folders: parsed.paths.length > 0 ? parsed.paths : undefined,
			files: parsed.files.length > 0 ? parsed.files : undefined,
		},
	}
}

export type SearchFilterKey = "tag" | "path" | "file"

export interface SearchQueryToken {
	kind: "filter" | "text"
	key?: SearchFilterKey
	value: string
	start: number
	end: number
}

export const SEARCH_FILTER_KEYS: readonly SearchFilterKey[] = ["path", "file", "tag"]

const SEARCH_FILTER_LABELS: Record<SearchFilterKey, string> = {
	path: "Folder",
	file: "File name",
	tag: "Tag",
}

export function tokenizeSearchQuery(raw: string): SearchQueryToken[] {
	const tokens: SearchQueryToken[] = []
	let lastIndex = 0
	for (const match of raw.matchAll(SEARCH_FILTER_PATTERN)) {
		const start = match.index ?? 0
		const text = raw.slice(lastIndex, start).trim()
		if (text) tokens.push({ kind: "text", value: text, start: lastIndex, end: start })
		tokens.push({
			kind: "filter",
			key: match[1].toLowerCase() as SearchFilterKey,
			value: match[2],
			start,
			end: start + match[0].length,
		})
		lastIndex = start + match[0].length
	}
	const rest = raw.slice(lastIndex).trim()
	if (rest) tokens.push({ kind: "text", value: rest, start: lastIndex, end: raw.length })
	return tokens
}

export function removeSearchQueryToken(raw: string, token: SearchQueryToken): string {
	return `${raw.slice(0, token.start)} ${raw.slice(token.end)}`.replace(/\s+/g, " ").trimStart()
}

export interface SearchSuggestion {
	kind: "operator" | "value" | "recent"
	label: string
	detail: string
	insert: string
	count?: number
}

export interface SearchSuggestionSources {
	folders: ReadonlyArray<{ path: string; noteCount: number }>
	tags: ReadonlyArray<{ tag: string; count: number }>
	recent: readonly string[]
	limit?: number
}

const DEFAULT_SUGGESTION_LIMIT = 8

function getActiveWord(raw: string): { word: string; start: number } {
	const start = raw.search(/\S*$/)
	return { word: raw.slice(start), start }
}

function replaceActiveWord(raw: string, start: number, replacement: string): string {
	return `${raw.slice(0, start)}${replacement}`
}

export function getSearchSuggestions(
	raw: string,
	sources: SearchSuggestionSources,
): SearchSuggestion[] {
	const limit = sources.limit ?? DEFAULT_SUGGESTION_LIMIT
	const { word, start } = getActiveWord(raw)
	const filterMatch = /^(tag|path|file):(.*)$/i.exec(word)
	if (filterMatch) {
		const key = filterMatch[1].toLowerCase() as SearchFilterKey
		const value = filterMatch[2].toLowerCase()
		if (key === "path") {
			return sources.folders
				.filter((folder) => folder.path.toLowerCase().startsWith(value))
				.slice(0, limit)
				.map((folder) => ({
					kind: "value",
					label: folder.path,
					detail: `${folder.noteCount} ${folder.noteCount === 1 ? "note" : "notes"}`,
					insert: replaceActiveWord(raw, start, `path:${folder.path} `),
					count: folder.noteCount,
				}))
		}
		if (key === "tag") {
			return sources.tags
				.filter((entry) => entry.tag.toLowerCase().startsWith(value))
				.slice(0, limit)
				.map((entry) => ({
					kind: "value",
					label: `#${entry.tag}`,
					detail: `${entry.count} ${entry.count === 1 ? "note" : "notes"}`,
					insert: replaceActiveWord(raw, start, `tag:${entry.tag} `),
					count: entry.count,
				}))
		}
		return []
	}
	const prefix = word.toLowerCase()
	const operators = SEARCH_FILTER_KEYS.filter((key) => prefix && `${key}:`.startsWith(prefix)).map(
		(key) => ({
			kind: "operator" as const,
			label: `${key}:`,
			detail: SEARCH_FILTER_LABELS[key],
			insert: replaceActiveWord(raw, start, `${key}:`),
		}),
	)
	if (raw.trim()) return operators
	const allOperators = SEARCH_FILTER_KEYS.map((key) => ({
		kind: "operator" as const,
		label: `${key}:`,
		detail: SEARCH_FILTER_LABELS[key],
		insert: `${key}:`,
	}))
	const recent = sources.recent.slice(0, limit).map((query) => ({
		kind: "recent" as const,
		label: query,
		detail: "Recent",
		insert: query,
	}))
	return [...allOperators, ...recent]
}
