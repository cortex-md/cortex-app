import type { ReactNode } from "react"

export interface ParsedLineEmbed {
	definitionId: string
	line: string
	data: unknown
	sourceFrom: number
	sourceTo: number
}

export interface LineEmbedRenderContext {
	embed: ParsedLineEmbed
	line: string
	data: unknown
	sourceFrom: number
	sourceTo: number
	filePath?: string
}

export interface LineEmbedLivePreview {
	title: string
	className?: string
	signature?: string
	mount: (container: HTMLElement) => undefined | (() => void)
}

export interface LineEmbedDefinition {
	id: string
	parse: (line: string) => unknown | null
	render: (context: LineEmbedRenderContext) => ReactNode
	renderLivePreview?: (context: LineEmbedRenderContext) => LineEmbedLivePreview | null
}

interface MarkdownLine {
	from: number
	to: number
	next: number
	text: string
}

function readLine(markdown: string, from: number): MarkdownLine {
	const newlineIndex = markdown.indexOf("\n", from)
	if (newlineIndex === -1) {
		return {
			from,
			to: markdown.length,
			next: markdown.length,
			text: markdown.slice(from),
		}
	}
	const to =
		newlineIndex > from && markdown[newlineIndex - 1] === "\r" ? newlineIndex - 1 : newlineIndex
	return {
		from,
		to,
		next: newlineIndex + 1,
		text: markdown.slice(from, to),
	}
}

export function parseLineEmbeds(
	markdown: string,
	definitions: readonly LineEmbedDefinition[] | undefined,
): ParsedLineEmbed[] {
	if (!definitions?.length) return []
	const embeds: ParsedLineEmbed[] = []
	let offset = 0

	while (offset < markdown.length) {
		const line = readLine(markdown, offset)
		for (const definition of definitions) {
			const data = definition.parse(line.text)
			if (data === null) continue
			embeds.push({
				definitionId: definition.id,
				line: line.text,
				data,
				sourceFrom: line.from,
				sourceTo: line.next,
			})
			break
		}
		if (line.next === offset) break
		offset = line.next
	}

	return embeds
}

export function getLineEmbedSignature(
	definitions: readonly LineEmbedDefinition[] | undefined,
): string {
	if (!definitions?.length) return ""
	return definitions
		.map((definition) => definition.id)
		.sort()
		.join("|")
}

export function findLineEmbedDefinition(
	definitions: readonly LineEmbedDefinition[] | undefined,
	definitionId: string,
): LineEmbedDefinition | null {
	if (!definitions?.length) return null
	return definitions.find((definition) => definition.id === definitionId) ?? null
}
