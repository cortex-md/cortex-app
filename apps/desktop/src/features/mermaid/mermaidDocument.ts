import { noteCache } from "@cortex/core"
import { type ParsedCodeBlockEmbed, parseFencedCodeBlocks } from "@cortex/editor/code-block-embeds"
import { projectRawNote } from "@cortex/properties"

export const MERMAID_FENCE_LANGUAGE = "mermaid"
export const MERMAID_DIAGRAM_VIEW_ID = "mermaid-diagram"

export interface MermaidDiagramReference {
	filePath: string
	source: string
	sourceHash: string
	sourceFrom: number
	sourceTo: number
	title: string
}

export interface MermaidDiagramViewState extends Record<string, unknown> {
	filePath: string
	sourceHash: string
	sourceFrom: number
	sourceTo: number
	title: string
}

export interface MermaidDiagramLookup {
	filePath: string
	sourceHash: string
	sourceFrom: number
	sourceTo: number
	title: string
}

const mermaidDirectivePattern = /^%%\{.*\}%%$/
const mermaidCommentPattern = /^%%(?!\{)/
const titleMaxLength = 52

export function normalizeMermaidSource(source: string): string {
	return source.trimEnd()
}

export function hashMermaidSource(source: string): string {
	const normalized = normalizeMermaidSource(source)
	let hash = 2166136261
	for (let index = 0; index < normalized.length; index++) {
		hash ^= normalized.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return `mmd-${(hash >>> 0).toString(36)}`
}

export function createMermaidDiagramTitle(source: string): string {
	const firstLine = normalizeMermaidSource(source)
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(
			(line) => line && !mermaidDirectivePattern.test(line) && !mermaidCommentPattern.test(line),
		)

	if (!firstLine) return "Mermaid diagram"
	if (firstLine.length <= titleMaxLength) return firstLine
	return `${firstLine.slice(0, titleMaxLength - 1)}...`
}

export function createMermaidDiagramReference(
	filePath: string,
	block: ParsedCodeBlockEmbed,
): MermaidDiagramReference {
	const source = normalizeMermaidSource(block.content)
	return {
		filePath,
		source,
		sourceHash: hashMermaidSource(source),
		sourceFrom: block.sourceFrom,
		sourceTo: block.sourceTo,
		title: createMermaidDiagramTitle(source),
	}
}

export function createMermaidDiagramViewState(
	reference: MermaidDiagramReference,
): MermaidDiagramViewState {
	return {
		filePath: reference.filePath,
		sourceHash: reference.sourceHash,
		sourceFrom: reference.sourceFrom,
		sourceTo: reference.sourceTo,
		title: reference.title,
	}
}

export function readMermaidDiagramViewState(value: unknown): MermaidDiagramViewState | null {
	if (!value || typeof value !== "object") return null
	const state = value as Record<string, unknown>
	return typeof state.filePath === "string" &&
		typeof state.sourceHash === "string" &&
		typeof state.sourceFrom === "number" &&
		typeof state.sourceTo === "number" &&
		typeof state.title === "string"
		? {
				filePath: state.filePath,
				sourceHash: state.sourceHash,
				sourceFrom: state.sourceFrom,
				sourceTo: state.sourceTo,
				title: state.title,
			}
		: null
}

export function findMermaidDiagramInBody(
	body: string,
	lookup: MermaidDiagramLookup,
): MermaidDiagramReference | null {
	const blocks = parseFencedCodeBlocks(body, [MERMAID_FENCE_LANGUAGE])
	const rangeMatch = blocks.find(
		(block) =>
			block.sourceFrom === lookup.sourceFrom &&
			block.sourceTo === lookup.sourceTo &&
			hashMermaidSource(block.content) === lookup.sourceHash,
	)
	const hashMatch =
		rangeMatch ?? blocks.find((block) => hashMermaidSource(block.content) === lookup.sourceHash)
	if (!hashMatch) return null
	return createMermaidDiagramReference(lookup.filePath, hashMatch)
}

export async function readMermaidDiagramFromNote(
	lookup: MermaidDiagramLookup,
): Promise<MermaidDiagramReference | null> {
	const entry = await noteCache.readEntry(lookup.filePath)
	return findMermaidDiagramInBody(projectRawNote(entry.content).body, lookup)
}
