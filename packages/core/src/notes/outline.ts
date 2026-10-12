export interface NoteHeading {
	level: number
	text: string
	line: number
}

const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const FENCE_PATTERN = /^\s*(```|~~~)/

export function extractHeadings(markdownBody: string): NoteHeading[] {
	const headings: NoteHeading[] = []
	let fence: string | null = null
	const lines = markdownBody.split("\n")
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]
		const fenceMatch = FENCE_PATTERN.exec(line)
		if (fenceMatch) {
			if (fence === null) fence = fenceMatch[1]
			else if (fence === fenceMatch[1]) fence = null
			continue
		}
		if (fence !== null) continue
		const match = HEADING_PATTERN.exec(line)
		if (match) headings.push({ level: match[1].length, text: match[2], line: index })
	}
	return headings
}

export function findActiveHeadingIndex(headings: readonly NoteHeading[], line: number): number {
	let active = -1
	for (let index = 0; index < headings.length; index++) {
		if (headings[index].line > line) break
		active = index
	}
	return active
}
