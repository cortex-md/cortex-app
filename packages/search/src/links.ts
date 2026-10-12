export interface WikiLink {
	target: string
	alias: string | null
	line: number
	context: string
}

const WIKI_LINK_PATTERN = /(?<!@)!?\[\[([^\]|#^]*)(?:[#^][^\]|]*)?(?:\|([^\]]*))?\]\]/g
const FENCE_PATTERN = /^\s*(```|~~~)/
const CONTEXT_LIMIT = 160

function toContext(line: string): string {
	const trimmed = line.trim()
	return trimmed.length > CONTEXT_LIMIT ? `${trimmed.slice(0, CONTEXT_LIMIT - 1)}…` : trimmed
}

export function extractWikiLinks(markdownBody: string): WikiLink[] {
	const links: WikiLink[] = []
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
		if (fence !== null || !line.includes("[[")) continue
		for (const match of line.matchAll(WIKI_LINK_PATTERN)) {
			const target = match[1].trim()
			if (!target) continue
			links.push({ target, alias: match[2]?.trim() || null, line: index, context: toContext(line) })
		}
	}
	return links
}
