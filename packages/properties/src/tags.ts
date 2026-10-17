export interface InlineTagRange {
	from: number
	to: number
	tag: string
}

const TAG_START = /[\p{L}_]/u
const TAG_CHAR = /[\p{L}\p{N}_/-]/u
const TAG_BOUNDARY = /[\s(*~>"'“‘]/u
const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})/
const INLINE_CODE_PATTERN = /(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g

export function isInlineTagBoundary(text: string, index: number): boolean {
	const previous = text[index - 1]
	if (previous === undefined) return true
	if (previous === "(" && text[index - 2] === "]") return false
	return TAG_BOUNDARY.test(previous)
}

export function normalizeTag(tag: string): string {
	return tag.trim().replace(/^#/, "").toLowerCase()
}

export function findInlineTags(text: string, offset = 0): InlineTagRange[] {
	const ranges: InlineTagRange[] = []
	let index = text.indexOf("#")
	while (index !== -1) {
		const start = text[index + 1]
		if (start && TAG_START.test(start) && isInlineTagBoundary(text, index)) {
			let end = index + 2
			while (end < text.length && TAG_CHAR.test(text[end] as string)) end++
			while (end > index + 2 && text[end - 1] === "/") end--
			ranges.push({ from: offset + index, to: offset + end, tag: text.slice(index + 1, end) })
			index = text.indexOf("#", end)
			continue
		}
		index = text.indexOf("#", index + 1)
	}
	return ranges
}

export function maskMarkdownCode(markdown: string): string {
	if (!markdown.includes("`") && !markdown.includes("~~~")) return markdown
	const lines = markdown.split("\n")
	let fence: string | null = null
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex] as string
		const marker = FENCE_PATTERN.exec(line)?.[1]
		if (fence) {
			if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null
			lines[lineIndex] = " ".repeat(line.length)
			continue
		}
		if (marker) {
			fence = marker
			lines[lineIndex] = " ".repeat(line.length)
		}
	}
	return lines.join("\n").replace(INLINE_CODE_PATTERN, (match) => match.replace(/[^\n]/g, " "))
}

export function findMarkdownInlineTags(markdown: string): InlineTagRange[] {
	if (!markdown.includes("#")) return []
	const masked = maskMarkdownCode(markdown)
	return findInlineTags(masked).map((range) => ({
		...range,
		tag: markdown.slice(range.from + 1, range.to),
	}))
}

export function extractMarkdownInlineTags(markdown: string): string[] {
	return [...new Set(findMarkdownInlineTags(markdown).map((range) => range.tag.toLowerCase()))]
}

export function tagMatches(tag: string, target: string): boolean {
	const normalized = tag.toLowerCase()
	return normalized === target || normalized.startsWith(`${target}/`)
}
