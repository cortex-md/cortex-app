import { projectRawNote } from "../frontmatter"
import { getDatabaseRowTitle } from "./paths"
import type { DatabaseRow } from "./types"

const EXCERPT_LENGTH = 160
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/u
const WIKI_IMAGE = /!\[\[([^\]|#]+\.(?:png|jpe?g|gif|webp|svg|avif))(?:[|#][^\]]*)?\]\]/iu

function toExcerpt(body: string): string {
	const lines: string[] = []
	let length = 0
	let inFence = false
	for (const line of body.split(/\r?\n/u)) {
		const trimmed = line.trim()
		if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
			inFence = !inFence
			continue
		}
		if (inFence || !trimmed || trimmed.startsWith("#") || trimmed.startsWith("![")) continue
		const text = trimmed
			.replace(/^(?:[-*+]\s+\[[ xX]\]\s+|[-*+>]\s+|\d+[.)]\s+)/u, "")
			.replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/gu, (_, target, alias) => alias ?? target)
			.replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
			.replace(/[*_`~]/gu, "")
			.trim()
		if (!text) continue
		lines.push(text)
		length += text.length + 1
		if (length >= EXCERPT_LENGTH) break
	}
	const excerpt = lines.join(" ")
	return excerpt.length > EXCERPT_LENGTH ? `${excerpt.slice(0, EXCERPT_LENGTH - 1)}…` : excerpt
}

const PREVIEW_LINES = 7
const PREVIEW_LINE_LENGTH = 48

function toPreview(title: string, body: string): string {
	const lines = [`# ${title}`, ""]
	for (const line of body.split(/\r?\n/u)) {
		const trimmed = line.trimEnd()
		if (!trimmed.trim() && lines[lines.length - 1] === "") continue
		if (trimmed.trimStart().startsWith("![")) continue
		lines.push(
			trimmed.length > PREVIEW_LINE_LENGTH
				? `${trimmed.slice(0, PREVIEW_LINE_LENGTH - 1)}…`
				: trimmed,
		)
		if (lines.length >= PREVIEW_LINES) break
	}
	return lines.join("\n").trimEnd()
}

function findCover(body: string): string | null {
	return MARKDOWN_IMAGE.exec(body)?.[1] ?? WIKI_IMAGE.exec(body)?.[1] ?? null
}

export function createDatabaseRow(
	path: string,
	raw: string,
	fingerprint: { mtime: number; size: number },
): DatabaseRow {
	const projection = projectRawNote(raw)
	const title = getDatabaseRowTitle(path)
	return {
		path,
		title,
		meta: projection.meta,
		excerpt: toExcerpt(projection.body),
		preview: toPreview(title, projection.body),
		cover: findCover(projection.body),
		mtime: fingerprint.mtime,
		size: fingerprint.size,
	}
}
