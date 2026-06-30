import type { ReactNode } from "react"

export interface ParsedCodeBlockEmbed {
	language: string
	info: string
	content: string
	sourceFrom: number
	sourceTo: number
	contentFrom: number
	contentTo: number
	openingFenceFrom: number
	openingFenceTo: number
	closingFenceFrom: number | null
	closingFenceTo: number | null
	fence: string
	fenceChar: "`" | "~"
}

export interface CodeBlockEmbedRenderContext {
	block: ParsedCodeBlockEmbed
	content: string
	sourceFrom: number
	sourceTo: number
	filePath?: string
}

export interface CodeBlockEmbedLivePreview {
	title: string
	description?: string
	meta?: string
	icon?: string
	tone?: "default" | "error"
	className?: string
	signature?: string
	mount?: (container: HTMLElement) => undefined | (() => void)
}

export interface CodeBlockEmbedLivePreviewOpenContext extends CodeBlockEmbedRenderContext {
	event: MouseEvent
}

export interface CodeBlockEmbedDefinition {
	languages: readonly string[]
	render: (context: CodeBlockEmbedRenderContext) => ReactNode
	renderLivePreview?: (context: CodeBlockEmbedRenderContext) => CodeBlockEmbedLivePreview | null
	canOpenLivePreview?: (context: CodeBlockEmbedRenderContext) => boolean
	openLivePreview?: (context: CodeBlockEmbedLivePreviewOpenContext) => void
	livePreviewOpenLabel?: string
}

interface MarkdownLine {
	from: number
	to: number
	next: number
	text: string
}

const openingFencePattern = /^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/

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

function getFenceLanguage(info: string): string {
	return (info.trim().split(/\s+/)[0] ?? "").toLowerCase()
}

function matchesLanguage(language: string, languages?: ReadonlySet<string>): boolean {
	return !languages || languages.has(language)
}

function isClosingFence(line: string, fenceChar: "`" | "~", fenceLength: number): boolean {
	const leadingSpaces = line.match(/^ */)?.[0].length ?? 0
	if (leadingSpaces > 3) return false
	const trimmed = line.trim()
	if (!trimmed || trimmed[0] !== fenceChar) return false
	for (let index = 0; index < trimmed.length; index++) {
		const char = trimmed[index]
		if (index < fenceLength) {
			if (char !== fenceChar) return false
			continue
		}
		if (char !== fenceChar && char !== " " && char !== "\t") return false
	}
	return trimmed.slice(0, fenceLength) === fenceChar.repeat(fenceLength)
}

export function parseFencedCodeBlocks(
	markdown: string,
	languages?: readonly string[],
): ParsedCodeBlockEmbed[] {
	const languageSet =
		languages && languages.length > 0
			? new Set(languages.map((language) => language.toLowerCase()))
			: undefined
	const blocks: ParsedCodeBlockEmbed[] = []
	let offset = 0

	while (offset < markdown.length) {
		const line = readLine(markdown, offset)
		const openingMatch = openingFencePattern.exec(line.text)
		if (!openingMatch) {
			offset = line.next
			continue
		}

		const fence = openingMatch[2]
		const fenceChar = fence[0] as "`" | "~"
		const info = openingMatch[3].trim()
		const language = getFenceLanguage(info)
		const contentFrom = line.next
		let searchOffset = line.next
		let closingLine: MarkdownLine | null = null

		while (searchOffset < markdown.length) {
			const candidate = readLine(markdown, searchOffset)
			if (isClosingFence(candidate.text, fenceChar, fence.length)) {
				closingLine = candidate
				break
			}
			if (candidate.next === searchOffset) break
			searchOffset = candidate.next
		}

		const contentTo = closingLine?.from ?? markdown.length
		const sourceTo = closingLine?.next ?? markdown.length
		const block: ParsedCodeBlockEmbed = {
			language,
			info,
			content: markdown.slice(contentFrom, contentTo),
			sourceFrom: line.from,
			sourceTo,
			contentFrom,
			contentTo,
			openingFenceFrom: line.from,
			openingFenceTo: line.to,
			closingFenceFrom: closingLine?.from ?? null,
			closingFenceTo: closingLine?.to ?? null,
			fence,
			fenceChar,
		}

		if (language && matchesLanguage(language, languageSet)) blocks.push(block)
		offset = sourceTo
	}

	return blocks
}

export function getCodeBlockEmbedSignature(
	definitions: readonly CodeBlockEmbedDefinition[] | undefined,
): string {
	if (!definitions?.length) return ""
	return definitions
		.flatMap((definition) => definition.languages.map((language) => language.toLowerCase()))
		.sort()
		.join("|")
}

export function getCodeBlockEmbedLanguages(
	definitions: readonly CodeBlockEmbedDefinition[] | undefined,
): string[] {
	if (!definitions?.length) return []
	return Array.from(
		new Set(
			definitions.flatMap((definition) =>
				definition.languages.map((language) => language.toLowerCase()),
			),
		),
	)
}

export function findCodeBlockEmbedDefinition(
	definitions: readonly CodeBlockEmbedDefinition[] | undefined,
	language: string,
): CodeBlockEmbedDefinition | null {
	if (!definitions?.length) return null
	const normalizedLanguage = language.toLowerCase()
	return (
		definitions.find((definition) =>
			definition.languages.some((candidate) => candidate.toLowerCase() === normalizedLanguage),
		) ?? null
	)
}
