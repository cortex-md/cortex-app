import { projectRawNote } from "@cortex/properties"

export interface PreparedSearchContent {
	tags: string[]
	aliases: string[]
	content: string
}

export function stripMarkdown(body: string): string {
	let text = body

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

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu

export function countWords(markdownBody: string): number {
	return stripMarkdown(markdownBody).match(WORD_PATTERN)?.length ?? 0
}

function toStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.map(String) : []
}

export function prepareSearchContent(raw: string): PreparedSearchContent {
	const { meta, body } = projectRawNote(raw)
	return {
		tags: toStringArray(meta.tags),
		aliases: toStringArray(meta.aliases),
		content: stripMarkdown(body),
	}
}
