import {
	type CodeBlockEmbedDefinition,
	type CodeBlockEmbedLivePreview,
	type CodeBlockEmbedRenderContext,
	findCodeBlockEmbedDefinition,
	type ParsedCodeBlockEmbed,
} from "../codeBlockEmbeds"
import type { EditorRuntimeState } from "../types"
import type { CodeBlock } from "./model"

interface CodeBlockEmbedMatch {
	definition: CodeBlockEmbedDefinition
	context: CodeBlockEmbedRenderContext
}

function getFenceInfo(
	state: EditorRuntimeState,
	block: CodeBlock,
): {
	fence: string
	fenceChar: "`" | "~"
} {
	const openingFence = state.sliceDoc(block.openFenceFrom, block.openFenceTo).trimStart()
	const match = openingFence.match(/^(`{3,}|~{3,})/)
	const fence = match?.[1] ?? "```"
	return {
		fence,
		fenceChar: fence[0] === "~" ? "~" : "`",
	}
}

function createParsedCodeBlock(state: EditorRuntimeState, block: CodeBlock): ParsedCodeBlockEmbed {
	const firstLine = state.doc.line(block.firstLine)
	const contentFrom = firstLine.to < block.to ? firstLine.to + 1 : firstLine.to
	const contentTo = Math.max(contentFrom, block.closeFenceFrom)
	const { fence, fenceChar } = getFenceInfo(state, block)
	return {
		language: block.language.toLowerCase(),
		info: block.language,
		content: block.code,
		sourceFrom: block.from,
		sourceTo: block.to,
		contentFrom,
		contentTo,
		openingFenceFrom: block.openFenceFrom,
		openingFenceTo: block.openFenceTo,
		closingFenceFrom: block.closeFenceFrom,
		closingFenceTo: block.closeFenceTo,
		fence,
		fenceChar,
	}
}

export function getCodeBlockEmbedMatch(
	state: EditorRuntimeState,
	block: CodeBlock,
	definitions: readonly CodeBlockEmbedDefinition[] | undefined,
	filePath: string,
): CodeBlockEmbedMatch | null {
	const definition = findCodeBlockEmbedDefinition(definitions, block.language)
	if (!definition) return null
	const parsedBlock = createParsedCodeBlock(state, block)
	return {
		definition,
		context: {
			block: parsedBlock,
			content: parsedBlock.content,
			sourceFrom: parsedBlock.sourceFrom,
			sourceTo: parsedBlock.sourceTo,
			filePath,
		},
	}
}

export function renderCodeBlockEmbedPreview(
	state: EditorRuntimeState,
	block: CodeBlock,
	definitions: readonly CodeBlockEmbedDefinition[] | undefined,
	filePath: string,
): CodeBlockEmbedLivePreview | null {
	const match = getCodeBlockEmbedMatch(state, block, definitions, filePath)
	return match?.definition.renderLivePreview?.(match.context) ?? null
}
