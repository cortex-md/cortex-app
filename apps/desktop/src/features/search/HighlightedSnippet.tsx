import type { SearchSnippet } from "@cortex/search"
import type { ReactNode } from "react"

interface HighlightedSnippetProps {
	snippet: SearchSnippet
	markClassName?: string
}

export function HighlightedSnippet({ snippet, markClassName }: HighlightedSnippetProps) {
	const parts: ReactNode[] = []
	let cursor = 0
	for (const [start, end] of snippet.ranges) {
		if (start > cursor) parts.push(snippet.text.slice(cursor, start))
		parts.push(
			<mark key={`${start}:${end}`} className={markClassName}>
				{snippet.text.slice(start, end)}
			</mark>,
		)
		cursor = end
	}
	if (cursor < snippet.text.length) parts.push(snippet.text.slice(cursor))
	return parts
}
