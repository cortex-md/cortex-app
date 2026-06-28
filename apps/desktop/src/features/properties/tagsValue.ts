import type { CSSProperties } from "react"

export type TagBadgeStyle = CSSProperties & {
	"--note-tag-color": string
}

export function getTagsFromPropertyValue(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	const tags: string[] = []
	const seenTags = new Set<string>()
	for (const tag of value
		.filter((tag): tag is string | number => typeof tag === "string" || typeof tag === "number")
		.map(String)) {
		const lookupKey = tag.toLowerCase()
		if (seenTags.has(lookupKey)) continue
		seenTags.add(lookupKey)
		tags.push(tag)
	}
	return tags
}

export function getTagBadgeStyle(color: string | null | undefined): TagBadgeStyle | undefined {
	return color ? { "--note-tag-color": color } : undefined
}
