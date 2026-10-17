import type { SearchMatchRange, SearchSnippet } from "@cortex/search"
import type { ReactNode } from "react"

interface HighlightedTextProps {
	text: string
	ranges: readonly SearchMatchRange[]
	markClassName?: string
}

interface HighlightedSnippetProps {
	snippet: SearchSnippet
	markClassName?: string
}

export function HighlightedText({ text, ranges, markClassName }: HighlightedTextProps) {
	if (ranges.length === 0) return text
	const parts: ReactNode[] = []
	let cursor = 0
	for (const [start, end] of ranges) {
		if (start < cursor || end > text.length) continue
		if (start > cursor) parts.push(text.slice(cursor, start))
		parts.push(
			<mark key={`${start}:${end}`} className={markClassName}>
				{text.slice(start, end)}
			</mark>,
		)
		cursor = end
	}
	if (cursor < text.length) parts.push(text.slice(cursor))
	return parts
}

export function HighlightedSnippet({ snippet, markClassName }: HighlightedSnippetProps) {
	return (
		<HighlightedText text={snippet.text} ranges={snippet.ranges} markClassName={markClassName} />
	)
}
