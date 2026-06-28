import { parseFrontmatter } from "@cortex/properties"

export function stripMarkdown(raw: string): string {
	let text = parseFrontmatter(raw).body

	text = text.replace(/```[\s\S]*?```/g, "")
	text = text.replace(/`[^`]+`/g, "")

	text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
	text = text.replace(/\[\[([^\]]+)\]\]/g, "$1")

	text = text.replace(/\[([^\]]*)\]\([^)]+\)/g, "$1")

	text = text.replace(/https?:\/\/\S+/g, "")

	text = text.replace(/#{1,6}\s+/g, "")
	text = text.replace(/[*_~]{1,3}/g, "")
	text = text.replace(/^>\s+/gm, "")
	text = text.replace(/^[-*+]\s+/gm, "")
	text = text.replace(/^\d+\.\s+/gm, "")
	text = text.replace(/^[-*_]{3,}$/gm, "")

	text = text.replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")

	return text.replace(/\n{3,}/g, "\n\n").trim()
}

export function extractFrontmatter(raw: string): {
	tags: string[]
	aliases: string[]
	content: string
} {
	const parsed = parseFrontmatter(raw)
	return {
		tags: Array.isArray(parsed.meta.tags) ? parsed.meta.tags.map(String) : [],
		aliases: Array.isArray(parsed.meta.aliases) ? parsed.meta.aliases.map(String) : [],
		content: parsed.body,
	}
}
