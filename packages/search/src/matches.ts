export type SearchMatchRange = readonly [start: number, end: number]

export interface SearchSnippet {
	text: string
	ranges: SearchMatchRange[]
}

export interface SearchMatches {
	count: number
	snippets: SearchSnippet[]
}

const SNIPPET_CONTEXT_CHARS = 60
const DEFAULT_MAX_SNIPPETS = 3
const ELLIPSIS = "…"
const regularExpressionSpecialCharacters = /[.*+?^${}()|[\]\\]/g

export function getSearchTerms(query: string): string[] {
	return query
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter((term) => term.length > 0)
}

function createTermPattern(terms: readonly string[]): RegExp | null {
	const escaped = terms.map((term) => term.replace(regularExpressionSpecialCharacters, "\\$&"))
	return escaped.length > 0 ? new RegExp(escaped.join("|"), "giu") : null
}

export function buildSearchMatches(
	content: string,
	query: string,
	maxSnippets = DEFAULT_MAX_SNIPPETS,
): SearchMatches {
	const pattern = createTermPattern(getSearchTerms(query))
	if (!pattern) return { count: 0, snippets: [] }
	const positions: Array<[number, number]> = []
	for (const match of content.matchAll(pattern)) {
		if (match[0].length === 0) continue
		positions.push([match.index, match.index + match[0].length])
	}
	const snippets: SearchSnippet[] = []
	let windowEnd = -1
	for (const [matchStart] of positions) {
		if (snippets.length >= maxSnippets) break
		if (matchStart < windowEnd) continue
		const start = Math.max(0, matchStart - SNIPPET_CONTEXT_CHARS)
		const end = Math.min(content.length, matchStart + SNIPPET_CONTEXT_CHARS)
		const prefix = start > 0 ? ELLIPSIS : ""
		const suffix = end < content.length ? ELLIPSIS : ""
		const ranges = positions
			.filter(([rangeStart, rangeEnd]) => rangeStart >= start && rangeEnd <= end)
			.map(
				([rangeStart, rangeEnd]) =>
					[rangeStart - start + prefix.length, rangeEnd - start + prefix.length] as const,
			)
		snippets.push({
			text: `${prefix}${content.slice(start, end).replace(/\n/g, " ")}${suffix}`,
			ranges,
		})
		windowEnd = end
	}
	return { count: positions.length, snippets }
}

export function splitSnippet(snippet: SearchSnippet): Array<{ text: string; match: boolean }> {
	const parts: Array<{ text: string; match: boolean }> = []
	let cursor = 0
	for (const [start, end] of snippet.ranges) {
		if (start > cursor) parts.push({ text: snippet.text.slice(cursor, start), match: false })
		parts.push({ text: snippet.text.slice(start, end), match: true })
		cursor = end
	}
	if (cursor < snippet.text.length) parts.push({ text: snippet.text.slice(cursor), match: false })
	return parts
}
