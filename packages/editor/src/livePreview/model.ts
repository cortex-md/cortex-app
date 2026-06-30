import { locateFrontmatter } from "@cortex/properties"
import { type ParsedCallout, parseCallout, parseCalloutMarker } from "@cortex/renderer"
import { findBlockMath, type MarkdownMathToken } from "@cortex/renderer/math"
import type { EditorRuntimeModules, EditorRuntimeState, EditorSelectionState } from "../types"

interface SyntaxNodeLike {
	name: string
	from: number
	to: number
	firstChild: SyntaxNodeLike | null
	nextSibling: SyntaxNodeLike | null
}

interface SyntaxNodeRefLike {
	node: SyntaxNodeLike
}

interface BaseBlock {
	id: string
	from: number
	to: number
	firstLine: number
	lastLine: number
}

interface SourceRange {
	from: number
	to: number
}

interface TableCellRange extends SourceRange {
	sourceFrom: number
	sourceTo: number
	contentFrom: number
	contentTo: number
	cursor: number
}

export interface TableCellModel extends TableCellRange {
	alignment: "left" | "center" | "right"
	rowIndex: number
	columnIndex: number
}

export interface TableRowModel extends SourceRange {
	rowIndex: number
	cells: TableCellModel[]
}

export interface TableModel {
	header: TableRowModel
	delimiter: TableRowModel
	rows: TableRowModel[]
	columnCount: number
}

export interface TableBlock extends BaseBlock {
	kind: "table"
	table: TableModel
}

export interface FrontmatterBlock extends BaseBlock {
	kind: "frontmatter"
}

export interface ImageBlock extends BaseBlock {
	kind: "image"
	src: string
	alt: string
}

export interface CalloutBlock extends BaseBlock {
	kind: "callout"
	callout: ParsedCallout
	titleFrom: number
}

export interface CodeBlock extends BaseBlock {
	kind: "code"
	language: string
	code: string
	openFenceFrom: number
	openFenceTo: number
	closeFenceFrom: number
	closeFenceTo: number
}

export interface HeadingBlock extends BaseBlock {
	kind: "heading"
	level: number
}

export interface BlockquoteBlock extends BaseBlock {
	kind: "blockquote"
}

export interface HorizontalRuleBlock extends BaseBlock {
	kind: "horizontalRule"
}

export interface MathBlock extends BaseBlock {
	kind: "math"
	source: string
	content: string
	openingFrom: number
	openingTo: number
	closingFrom: number
	closingTo: number
}

export type MarkdownBlock =
	| TableBlock
	| FrontmatterBlock
	| ImageBlock
	| CalloutBlock
	| CodeBlock
	| HeadingBlock
	| BlockquoteBlock
	| HorizontalRuleBlock
	| MathBlock

export interface MarkdownBlockIndex {
	all: MarkdownBlock[]
	callouts: CalloutBlock[]
	blockquotes: BlockquoteBlock[]
	code: CodeBlock[]
	math: MathBlock[]
	tables: TableBlock[]
}

const headingLevels: Record<string, number> = {
	ATXHeading1: 1,
	ATXHeading2: 2,
	ATXHeading3: 3,
	ATXHeading4: 4,
	ATXHeading5: 5,
	ATXHeading6: 6,
}

function createBaseBlock(
	state: EditorRuntimeState,
	kind: MarkdownBlock["kind"],
	from: number,
	to: number,
): BaseBlock {
	const first = state.doc.lineAt(from)
	const adjustedTo = to > from && state.doc.sliceString(to - 1, to) === "\n" ? to - 1 : to
	const last = state.doc.lineAt(adjustedTo)
	return {
		id: `${kind}:${first.from}`,
		from: first.from,
		to: last.to,
		firstLine: first.number,
		lastLine: last.number,
	}
}

function childNodes(node: SyntaxNodeLike, name: string): SyntaxNodeLike[] {
	const children: SyntaxNodeLike[] = []
	for (let child = node.firstChild; child; child = child.nextSibling) {
		if (child.name === name) children.push(child)
	}
	return children
}

function parseAlignment(value: string): "left" | "center" | "right" {
	const trimmed = value.trim()
	if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center"
	if (trimmed.endsWith(":")) return "right"
	return "left"
}

function trimCellRange(state: EditorRuntimeState, from: number, to: number): TableCellRange {
	const source = state.sliceDoc(from, to)
	const leadingWhitespace = source.length - source.trimStart().length
	const trailingWhitespace = source.length - source.trimEnd().length
	const contentFrom = from + leadingWhitespace
	const contentTo = Math.max(contentFrom, to - trailingWhitespace)

	if (source.trim().length === 0) {
		const cursorPosition = from + Math.floor(source.length / 2)
		return {
			sourceFrom: from,
			sourceTo: to,
			contentFrom,
			contentTo,
			from,
			to,
			cursor: cursorPosition,
		}
	}
	return {
		sourceFrom: from,
		sourceTo: to,
		contentFrom,
		contentTo,
		from: contentFrom,
		to: contentTo,
		cursor: contentFrom,
	}
}

function createTableRowModel(
	state: EditorRuntimeState,
	node: SyntaxNodeLike,
	alignments: TableCellModel["alignment"][],
	rowIndex: number,
): TableRowModel {
	const delimiters = childNodes(node, "TableDelimiter")
	const leadingDelimiter = delimiters[0]?.from === node.from
	const trailingDelimiter = delimiters.at(-1)?.to === node.to
	const segmentRanges: TableCellRange[] = []
	let segmentFrom = leadingDelimiter ? delimiters[0].to : node.from
	const lastDelimiterIndex = trailingDelimiter ? delimiters.length - 1 : delimiters.length

	for (
		let delimiterIndex = leadingDelimiter ? 1 : 0;
		delimiterIndex < lastDelimiterIndex;
		delimiterIndex++
	) {
		const delimiter = delimiters[delimiterIndex]
		segmentRanges.push(trimCellRange(state, segmentFrom, delimiter.from))
		segmentFrom = delimiter.to
	}

	const segmentTo = trailingDelimiter ? delimiters.at(-1)?.from : node.to
	if (segmentTo !== undefined) {
		segmentRanges.push(trimCellRange(state, segmentFrom, segmentTo))
	}

	const columnCount = Math.max(alignments.length, segmentRanges.length)
	const cells = Array.from({ length: columnCount }, (_, index) => {
		const range = segmentRanges[index] ?? {
			sourceFrom: node.to,
			sourceTo: node.to,
			contentFrom: node.to,
			contentTo: node.to,
			from: node.to,
			to: node.to,
			cursor: node.to,
		}
		return {
			...range,
			alignment: alignments[index] ?? "left",
			rowIndex,
			columnIndex: index,
		}
	})

	return { from: node.from, to: node.to, rowIndex, cells }
}

function createTableDelimiterModel(state: EditorRuntimeState, node: SyntaxNodeLike): TableRowModel {
	const source = state.doc.sliceString(node.from, node.to)
	const contentStart = source.search(/\S/)
	const contentEndMatch = source.match(/\S(?=\s*$)/)
	const contentEnd =
		contentEndMatch?.index === undefined ? source.length : contentEndMatch.index + 1
	const leadingDelimiter = source[contentStart] === "|"
	const trailingDelimiter = source[contentEnd - 1] === "|"
	const segmentRanges: TableCellRange[] = []
	let segmentFrom = leadingDelimiter ? contentStart + 1 : Math.max(contentStart, 0)
	const segmentTo = trailingDelimiter ? contentEnd - 1 : contentEnd

	for (let index = segmentFrom; index < segmentTo; index++) {
		if (source[index] !== "|") continue
		segmentRanges.push(trimCellRange(state, node.from + segmentFrom, node.from + index))
		segmentFrom = index + 1
	}
	segmentRanges.push(trimCellRange(state, node.from + segmentFrom, node.from + segmentTo))

	return {
		from: node.from,
		to: node.to,
		rowIndex: -1,
		cells: segmentRanges.map((range, index) => ({
			...range,
			alignment: parseAlignment(state.doc.sliceString(range.contentFrom, range.contentTo)),
			rowIndex: -1,
			columnIndex: index,
		})),
	}
}

function createTableModel(state: EditorRuntimeState, node: SyntaxNodeLike): TableModel {
	const header = childNodes(node, "TableHeader")[0]
	const rows = childNodes(node, "TableRow")
	const delimiter = childNodes(node, "TableDelimiter")[0]
	if (!header || !delimiter) {
		const emptyRow = { from: node.from, to: node.from, rowIndex: 0, cells: [] }
		return {
			header: emptyRow,
			delimiter: emptyRow,
			rows: [],
			columnCount: 0,
		}
	}
	const delimiterRow = createTableDelimiterModel(state, delimiter)
	const alignments = delimiterRow.cells.map((cell) => cell.alignment)

	return {
		header: createTableRowModel(state, header, alignments, 0),
		delimiter: delimiterRow,
		rows: rows.map((row, index) => createTableRowModel(state, row, alignments, index + 1)),
		columnCount: alignments.length,
	}
}

function createCalloutBlock(state: EditorRuntimeState, node: SyntaxNodeLike): CalloutBlock | null {
	const base = createBaseBlock(state, "callout", node.from, node.to)
	const source = state.doc.sliceString(base.from, base.to)
	const callout = parseCallout(source)
	if (!callout) return null

	const firstLine = state.doc.line(base.firstLine)
	const marker = parseCalloutMarker(firstLine.text)
	const titleFrom = marker ? firstLine.from + marker.markerLength : firstLine.to
	return {
		...base,
		kind: "callout",
		callout,
		titleFrom,
	}
}

function createCodeBlock(state: EditorRuntimeState, node: SyntaxNodeLike): CodeBlock {
	const base = createBaseBlock(state, "code", node.from, node.to)
	const firstLine = state.doc.line(base.firstLine)
	const lastLine = state.doc.line(base.lastLine)
	const info = childNodes(node, "CodeInfo")[0]
	const code = childNodes(node, "CodeText")
		.map((child) => state.doc.sliceString(child.from, child.to))
		.join("")

	return {
		...base,
		kind: "code",
		language: info ? state.doc.sliceString(info.from, info.to).trim() : "",
		code,
		openFenceFrom: firstLine.from,
		openFenceTo: firstLine.to,
		closeFenceFrom: lastLine.from,
		closeFenceTo: lastLine.to,
	}
}

function createImageBlock(
	state: EditorRuntimeState,
	node: SyntaxNodeLike,
	resolveImageUrl: (src: string, filePath: string) => string,
	filePath: string,
): ImageBlock | null {
	const source = state.doc.sliceString(node.from, node.to)
	const match = source.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)$/)
	if (!match) return null
	const base = createBaseBlock(state, "image", node.from, node.to)
	return {
		...base,
		id: `image:${node.from}`,
		from: node.from,
		to: node.to,
		kind: "image",
		alt: match[1],
		src: resolveImageUrl(match[2], filePath),
	}
}

function createMathBlock(state: EditorRuntimeState, token: MarkdownMathToken): MathBlock {
	const base = createBaseBlock(state, "math", token.from, token.to)
	return {
		...base,
		kind: "math",
		source: token.source,
		content: token.content,
		openingFrom: token.openingFrom,
		openingTo: token.openingTo,
		closingFrom: token.closingFrom,
		closingTo: token.closingTo,
	}
}

export function collectMarkdownBlocks(
	runtime: EditorRuntimeModules,
	state: EditorRuntimeState,
	resolveImageUrl: (src: string, filePath: string) => string,
	filePath: string,
): MarkdownBlock[] {
	const blocks: MarkdownBlock[] = []
	const frontmatter = locateFrontmatter(state.doc.toString())
	if (frontmatter) {
		const base = createBaseBlock(state, "frontmatter", frontmatter.from, frontmatter.to)
		blocks.push({ ...base, kind: "frontmatter" })
	}

	runtime.language.syntaxTree(state).iterate({
		enter(nodeRef: SyntaxNodeRefLike) {
			const node = nodeRef.node as SyntaxNodeLike
			const headingLevel = headingLevels[node.name]
			if (headingLevel) {
				const base = createBaseBlock(state, "heading", node.from, node.to)
				blocks.push({ ...base, kind: "heading", level: headingLevel })
				return
			}
			if (node.name === "Table") {
				const base = createBaseBlock(state, "table", node.from, node.to)
				blocks.push({ ...base, kind: "table", table: createTableModel(state, node) })
				return false
			}
			if (node.name === "FencedCode") {
				blocks.push(createCodeBlock(state, node))
				return false
			}
			if (node.name === "Blockquote") {
				const callout = createCalloutBlock(state, node)
				if (callout) blocks.push(callout)
				else {
					const base = createBaseBlock(state, "blockquote", node.from, node.to)
					blocks.push({ ...base, kind: "blockquote" })
				}
				return false
			}
			if (node.name === "HorizontalRule") {
				const base = createBaseBlock(state, "horizontalRule", node.from, node.to)
				if (!frontmatter || base.from >= frontmatter.to) {
					blocks.push({ ...base, kind: "horizontalRule" })
				}
				return false
			}
			if (node.name === "Image") {
				const image = createImageBlock(state, node, resolveImageUrl, filePath)
				if (image) blocks.push(image)
				return false
			}
		},
	})

	const sourceBlocks = blocks
		.filter((block) => block.kind === "code" || block.kind === "frontmatter")
		.sort((left, right) => left.from - right.from || left.to - right.to)
	for (const token of findBlockMath(state.doc.toString())) {
		if (findBlockContainingRange(sourceBlocks, token.from, token.to)) continue
		blocks.push(createMathBlock(state, token))
	}

	return blocks.sort((left, right) => left.from - right.from || left.to - right.to)
}

export function createMarkdownBlockIndex(blocks: MarkdownBlock[]): MarkdownBlockIndex {
	return {
		all: blocks,
		callouts: blocks.filter((block): block is CalloutBlock => block.kind === "callout"),
		blockquotes: blocks.filter((block): block is BlockquoteBlock => block.kind === "blockquote"),
		code: blocks.filter((block): block is CodeBlock => block.kind === "code"),
		math: blocks.filter((block): block is MathBlock => block.kind === "math"),
		tables: blocks.filter((block): block is TableBlock => block.kind === "table"),
	}
}

export function findBlocksInRange<T extends Pick<MarkdownBlock, "from" | "to">>(
	blocks: readonly T[],
	from: number,
	to: number,
): T[] {
	let low = 0
	let high = blocks.length
	while (low < high) {
		const middle = Math.floor((low + high) / 2)
		if (blocks[middle].from < from) low = middle + 1
		else high = middle
	}
	const matches: T[] = []
	for (let index = Math.max(0, low - 1); index < blocks.length; index++) {
		const block = blocks[index]
		if (block.from > to) break
		if (block.to >= from) matches.push(block)
	}
	return matches
}

export function findBlockContainingRange<T extends Pick<MarkdownBlock, "from" | "to">>(
	blocks: readonly T[],
	from: number,
	to: number,
): T | undefined {
	let low = 0
	let high = blocks.length - 1
	let candidate: T | undefined
	while (low <= high) {
		const middle = Math.floor((low + high) / 2)
		const block = blocks[middle]
		if (block.from <= from) {
			candidate = block
			low = middle + 1
		} else {
			high = middle - 1
		}
	}
	return candidate && to <= candidate.to ? candidate : undefined
}

export function selectionOverlapsBlock(
	selection: EditorSelectionState,
	block: Pick<MarkdownBlock, "from" | "to">,
): boolean {
	return selection.ranges.some((range) => range.from <= block.to && range.to >= block.from)
}

export function blockUsesReplacement(
	block: MarkdownBlock,
	_collapsedCallouts: ReadonlyMap<string, boolean>,
	selection: EditorSelectionState,
): boolean {
	if (selectionOverlapsBlock(selection, block)) return false
	return block.kind === "image" || block.kind === "horizontalRule" || block.kind === "math"
}
