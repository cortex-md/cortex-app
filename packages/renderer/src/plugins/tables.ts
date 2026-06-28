import type { Plugin } from "unified"
import { getRendererFeatureFlags } from "../features"

type TableAlignment = "left" | "right" | "center" | null

interface MarkdownNode {
	type: string
	value?: string
	children?: MarkdownNode[]
	align?: TableAlignment[]
	position?: unknown
	[key: string]: unknown
}

interface MarkdownParent {
	children?: MarkdownNode[]
}

function cloneMarkdownNode(node: MarkdownNode): MarkdownNode {
	return {
		...node,
		children: node.children?.map(cloneMarkdownNode),
	}
}

function appendText(nodes: MarkdownNode[], value: string): void {
	if (!value) return
	const last = nodes.at(-1)
	if (last?.type === "text") {
		last.value = `${last.value ?? ""}${value}`
		return
	}
	nodes.push({ type: "text", value })
}

function nodeText(node: MarkdownNode): string {
	if (typeof node.value === "string") return node.value
	return node.children?.map(nodeText).join("") ?? ""
}

function childrenText(children: readonly MarkdownNode[]): string {
	return children.map(nodeText).join("")
}

function splitTextByTablePipes(value: string): string[] {
	const cells = [""]
	let insideWikiLink = false
	for (let index = 0; index < value.length; index++) {
		const current = value[index]
		const next = value[index + 1]
		if (current === "\\" && next === "|") {
			cells[cells.length - 1] += "|"
			index++
			continue
		}
		if (current === "[" && next === "[") {
			insideWikiLink = true
			cells[cells.length - 1] += "[["
			index++
			continue
		}
		if (insideWikiLink && current === "]" && next === "]") {
			insideWikiLink = false
			cells[cells.length - 1] += "]]"
			index++
			continue
		}
		if (current === "|" && !insideWikiLink) {
			cells.push("")
			continue
		}
		cells[cells.length - 1] += current
	}
	return cells
}

function splitParagraphLines(children: readonly MarkdownNode[]): MarkdownNode[][] {
	const lines: MarkdownNode[][] = [[]]
	for (const child of children) {
		if (child.type !== "text") {
			lines[lines.length - 1].push(cloneMarkdownNode(child))
			continue
		}
		const parts = (child.value ?? "").split("\n")
		for (let index = 0; index < parts.length; index++) {
			appendText(lines[lines.length - 1], parts[index])
			if (index < parts.length - 1) lines.push([])
		}
	}
	return lines
}

function trimCellChildren(children: MarkdownNode[]): MarkdownNode[] {
	const trimmed = children.filter((child) => child.type !== "text" || nodeText(child).length > 0)
	const first = trimmed[0]
	if (first?.type === "text") first.value = first.value?.trimStart()
	const last = trimmed.at(-1)
	if (last?.type === "text") last.value = last.value?.trimEnd()
	return trimmed.filter((child) => child.type !== "text" || nodeText(child).length > 0)
}

function isWhitespaceCell(children: readonly MarkdownNode[]): boolean {
	return childrenText(children).trim().length === 0
}

function splitLineCells(line: readonly MarkdownNode[]): MarkdownNode[][] {
	let cells: MarkdownNode[][] = [[]]
	for (const node of line) {
		if (node.type !== "text") {
			cells[cells.length - 1].push(cloneMarkdownNode(node))
			continue
		}
		const parts = splitTextByTablePipes(node.value ?? "")
		for (let index = 0; index < parts.length; index++) {
			appendText(cells[cells.length - 1], parts[index])
			if (index < parts.length - 1) cells.push([])
		}
	}
	const lineText = childrenText(line).trim()
	if (lineText.startsWith("|") && isWhitespaceCell(cells[0])) cells = cells.slice(1)
	if (lineText.endsWith("|") && isWhitespaceCell(cells.at(-1) ?? [])) cells = cells.slice(0, -1)
	return cells.map(trimCellChildren)
}

function splitTextCells(lineText: string): string[] {
	let cells = lineText.trim().split("|")
	if (cells[0]?.trim() === "") cells = cells.slice(1)
	if (cells.at(-1)?.trim() === "") cells = cells.slice(0, -1)
	return cells.map((cell) => cell.trim())
}

function parseAlignmentLine(lineText: string): TableAlignment[] | null {
	const cells = splitTextCells(lineText)
	if (cells.length === 0) return null
	const alignments: TableAlignment[] = []
	for (const cell of cells) {
		const marker = cell.replace(/\s+/g, "")
		if (!/^:?-{3,}:?$/.test(marker)) return null
		alignments.push(
			marker.startsWith(":") && marker.endsWith(":")
				? "center"
				: marker.endsWith(":")
					? "right"
					: marker.startsWith(":")
						? "left"
						: null,
		)
	}
	return alignments
}

function normalizeCells(cells: MarkdownNode[][], count: number): MarkdownNode[][] | null {
	if (cells.length > count) return null
	return [...cells, ...Array.from({ length: count - cells.length }, () => [])]
}

function createTableRow(cells: MarkdownNode[][]): MarkdownNode {
	return {
		type: "tableRow",
		children: cells.map((children) => ({
			type: "tableCell",
			children,
		})),
	}
}

function createTableFromParagraph(paragraph: MarkdownNode): MarkdownNode | null {
	const lines = splitParagraphLines(paragraph.children ?? [])
	if (lines.length < 2) return null
	const lineTexts = lines.map((line) => childrenText(line))
	const align = parseAlignmentLine(lineTexts[1])
	if (!align) return null
	const headerCells = normalizeCells(splitLineCells(lines[0]), align.length)
	if (!headerCells) return null
	const bodyRows: MarkdownNode[] = []
	for (const line of lines.slice(2)) {
		if (childrenText(line).trim().length === 0) return null
		const cells = normalizeCells(splitLineCells(line), align.length)
		if (!cells) return null
		bodyRows.push(createTableRow(cells))
	}
	return {
		type: "table",
		align,
		children: [createTableRow(headerCells), ...bodyRows],
	}
}

function transformTables(parent: MarkdownParent): void {
	const children = parent.children
	if (!children) return
	for (let index = 0; index < children.length; index++) {
		const child = children[index]
		if (child.type === "paragraph") {
			const table = createTableFromParagraph(child)
			if (table) {
				children[index] = table
				continue
			}
		}
		transformTables(child)
	}
}

export const remarkFastTables: Plugin = () => {
	return (tree, file) => {
		if (!getRendererFeatureFlags(file).hasTables) return
		transformTables(tree as MarkdownParent)
	}
}
