import { getBaseName, getExtension } from "@cortex/platform/utils"
import { addFinding, type ObsidianFindings } from "./findings"

export type ResolveObsidianEmbed = (target: string) => string | null

export interface ObsidianMarkdownResult {
	content: string
	convertedEmbeds: number
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"])
const FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})\s*([\w-]*)/u
const INLINE_CODE_PATTERN = /(`+)[^`]*?\1/gu
const EMBED_PATTERN = /!\[\[([^\]\n]+?)\]\]/gu
const WIKI_LINK_PATTERN = /(^|[^!])\[\[([^\]\n]+?)\]\]/gu
const BLOCK_ID_PATTERN = /(?:^|\s)\^[A-Za-z0-9-]+\s*$/u
const HIGHLIGHT_PATTERN = /==[^=\n]+==/gu
const TEMPLATER_PATTERN = /<%[\s\S]*?%>/gu
const SIZE_ALIAS_PATTERN = /^\d+(?:x\d+)?$/u
const DATAVIEW_LANGUAGES = new Set(["dataview", "dataviewjs"])

function countMatches(text: string, pattern: RegExp): number {
	return text.match(pattern)?.length ?? 0
}

function mapOutsideInlineCode(line: string, transform: (text: string) => string): string {
	let result = ""
	let lastIndex = 0
	for (const match of line.matchAll(INLINE_CODE_PATTERN)) {
		result += transform(line.slice(lastIndex, match.index)) + match[0]
		lastIndex = match.index + match[0].length
	}
	return result + transform(line.slice(lastIndex))
}

function splitLinkTarget(inner: string): { target: string; alias: string | null } {
	const separator = inner.indexOf("|")
	const rawTarget = separator === -1 ? inner : inner.slice(0, separator)
	const subpath = rawTarget.indexOf("#")
	return {
		target: (subpath === -1 ? rawTarget : rawTarget.slice(0, subpath)).trim(),
		alias: separator === -1 ? null : inner.slice(separator + 1).trim(),
	}
}

function getEmbedAltText(target: string, alias: string | null): string {
	const name = getBaseName(target)
	const alt = !alias ? name : SIZE_ALIAS_PATTERN.test(alias) ? `${name}|${alias}` : alias
	return alt.replace(/[[\]]/gu, "")
}

function getFrontmatterEnd(lines: readonly string[]): number {
	if (lines[0]?.trim() !== "---") return 0
	for (let index = 1; index < lines.length; index++) {
		if (lines[index]?.trim() === "---") return index + 1
	}
	return 0
}

export function convertObsidianMarkdown(
	content: string,
	findings: ObsidianFindings,
	resolveEmbed?: ResolveObsidianEmbed,
): ObsidianMarkdownResult {
	const lines = content.split("\n")
	let convertedEmbeds = 0
	let commentMarkers = 0
	let fence: { marker: string; length: number } | null = null

	const convertEmbeds = (text: string) =>
		text.replace(EMBED_PATTERN, (match, inner: string) => {
			const { target, alias } = splitLinkTarget(inner)
			const extension = getExtension(target)
			if (!extension || extension === "md") {
				addFinding(findings, "note-embed")
				return match
			}
			if (!IMAGE_EXTENSIONS.has(extension)) {
				addFinding(findings, "file-embed")
				return match
			}
			if (!resolveEmbed) {
				addFinding(findings, "image-embed")
				return match
			}
			const link = resolveEmbed(target)
			if (link === null) {
				addFinding(findings, "missing-attachment", target)
				return match
			}
			convertedEmbeds++
			return `![${getEmbedAltText(target, alias)}](${link})`
		})

	const transformText = (text: string) => {
		commentMarkers += countMatches(text, /%%/gu)
		addFinding(findings, "highlight", undefined, countMatches(text, HIGHLIGHT_PATTERN))
		addFinding(findings, "templater", undefined, countMatches(text, TEMPLATER_PATTERN))
		for (const match of text.matchAll(WIKI_LINK_PATTERN)) {
			const extension = getExtension(splitLinkTarget(match[2] ?? "").target)
			if (extension && extension !== "md") addFinding(findings, "attachment-link")
		}
		return convertEmbeds(text)
	}

	for (let index = getFrontmatterEnd(lines); index < lines.length; index++) {
		const line = lines[index] ?? ""
		const fenceMatch = FENCE_PATTERN.exec(line)
		if (fence) {
			const marker = fenceMatch?.[1]
			if (
				marker?.[0] === fence.marker &&
				marker.length >= fence.length &&
				!fenceMatch?.[2] &&
				line.trim() === marker
			) {
				fence = null
			}
			continue
		}
		if (fenceMatch?.[1]) {
			fence = { marker: fenceMatch[1][0] ?? "`", length: fenceMatch[1].length }
			if (DATAVIEW_LANGUAGES.has((fenceMatch[2] ?? "").toLocaleLowerCase())) {
				addFinding(findings, "dataview")
			}
			continue
		}
		if (BLOCK_ID_PATTERN.test(line)) addFinding(findings, "block-id")
		lines[index] = mapOutsideInlineCode(line, transformText)
	}

	addFinding(findings, "comment", undefined, Math.ceil(commentMarkers / 2))
	return {
		content: convertedEmbeds > 0 ? lines.join("\n") : content,
		convertedEmbeds,
	}
}

export function encodeMarkdownLinkPath(path: string): string {
	return path.replace(/[%\s()<>[\]#?]/gu, (character) => {
		return `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
	})
}
