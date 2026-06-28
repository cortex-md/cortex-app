import type { EditorRuntimeModules, EditorRuntimeState, EditorRuntimeView } from "./types"

export type TableCellAlignment = "left" | "center" | "right"

export interface MarkdownTableCell {
	text: string
	sourceFrom: number
	sourceTo: number
	contentFrom: number
	contentTo: number
	cursor: number
}

export interface MarkdownTableRow {
	lineNumber: number
	from: number
	to: number
	cells: MarkdownTableCell[]
}

export interface MarkdownTableContext {
	from: number
	to: number
	startLineNumber: number
	delimiterLineNumber: number
	endLineNumber: number
	columnCount: number
	rows: MarkdownTableRow[]
	alignments: TableCellAlignment[]
	activeRowIndex: number
	activeColumnIndex: number
}

interface TableLine {
	number: number
	from: number
	to: number
	text: string
}

interface TableReplacement {
	markdown: string
	selectionOffset: number
}

export interface ParsedPastedTable {
	rows: string[][]
	alignments: TableCellAlignment[]
}

interface VimModeState {
	exMode?: boolean
	insertMode?: boolean
	visualMode?: boolean
}

const defaultTableRows = [
	["", ""],
	["", ""],
]

function isEscaped(text: string, index: number): boolean {
	let backslashCount = 0
	for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor--) {
		backslashCount++
	}
	return backslashCount % 2 === 1
}

function findUnescapedPipes(text: string): number[] {
	const pipes: number[] = []
	for (let index = 0; index < text.length; index++) {
		if (text[index] === "|" && !isEscaped(text, index)) pipes.push(index)
	}
	return pipes
}

function lastNonWhitespaceOffset(text: string): number {
	const match = text.match(/\S(?=\s*$)/)
	return match?.index === undefined ? -1 : match.index
}

function cellCursorFromSegment(from: number, to: number, text: string): number {
	if (text.trim().length > 0) {
		const leadingWhitespace = text.length - text.trimStart().length
		return from + leadingWhitespace
	}
	return Math.min(to, from + Math.floor((to - from) / 2))
}

function createCell(line: TableLine, fromOffset: number, toOffset: number): MarkdownTableCell {
	const source = line.text.slice(fromOffset, toOffset)
	const leadingWhitespace = source.length - source.trimStart().length
	const trailingWhitespace = source.length - source.trimEnd().length
	const contentFrom = line.from + fromOffset + leadingWhitespace
	const contentTo = Math.max(contentFrom, line.from + toOffset - trailingWhitespace)

	return {
		text: source.trim(),
		sourceFrom: line.from + fromOffset,
		sourceTo: line.from + toOffset,
		contentFrom,
		contentTo,
		cursor: cellCursorFromSegment(line.from + fromOffset, line.from + toOffset, source),
	}
}

function parseTableLine(line: TableLine, columnCount = 0): MarkdownTableRow | null {
	const contentStart = line.text.search(/\S/)
	const contentEnd = lastNonWhitespaceOffset(line.text) + 1
	if (contentStart < 0 || contentEnd <= contentStart) return null

	const pipeOffsets = findUnescapedPipes(line.text).filter(
		(offset) => offset >= contentStart && offset < contentEnd,
	)
	if (pipeOffsets.length === 0) return null

	const leadingPipe = line.text[contentStart] === "|"
	const trailingPipe = line.text[contentEnd - 1] === "|"
	const splitPipeOffsets = pipeOffsets.filter((offset) => {
		if (leadingPipe && offset === contentStart) return false
		if (trailingPipe && offset === contentEnd - 1) return false
		return true
	})
	const cells: MarkdownTableCell[] = []
	let segmentFrom = leadingPipe ? contentStart + 1 : contentStart
	const segmentTo = trailingPipe ? contentEnd - 1 : contentEnd

	for (const pipeOffset of splitPipeOffsets) {
		if (pipeOffset < segmentFrom || pipeOffset > segmentTo) continue
		cells.push(createCell(line, segmentFrom, pipeOffset))
		segmentFrom = pipeOffset + 1
	}
	cells.push(createCell(line, segmentFrom, segmentTo))

	while (cells.length < columnCount) {
		cells.push({
			text: "",
			sourceFrom: line.to,
			sourceTo: line.to,
			contentFrom: line.to,
			contentTo: line.to,
			cursor: line.to,
		})
	}

	return {
		lineNumber: line.number,
		from: line.from,
		to: line.to,
		cells,
	}
}

function isTableLikeLine(text: string): boolean {
	return findUnescapedPipes(text).length > 0
}

function isDelimiterCell(text: string): boolean {
	return /^:?-{3,}:?$/.test(text.trim())
}

function parseAlignment(text: string): TableCellAlignment {
	const trimmed = text.trim()
	if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center"
	if (trimmed.endsWith(":")) return "right"
	return "left"
}

function parseDelimiterLine(line: TableLine): MarkdownTableRow | null {
	const row = parseTableLine(line)
	if (!row || row.cells.length === 0) return null
	return row.cells.every((cell) => isDelimiterCell(cell.text)) ? row : null
}

function getLine(state: EditorRuntimeState, lineNumber: number): TableLine {
	const line = state.doc.line(lineNumber)
	return {
		number: line.number,
		from: line.from,
		to: line.to,
		text: line.text,
	}
}

function getRows(table: MarkdownTableContext): string[][] {
	return table.rows.map((row) =>
		Array.from({ length: table.columnCount }, (_, index) => row.cells[index]?.text ?? ""),
	)
}

export function getMarkdownTableRows(table: MarkdownTableContext): string[][] {
	return getRows(table)
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): void {
	if (fromIndex === toIndex) return
	const [item] = items.splice(fromIndex, 1)
	items.splice(toIndex, 0, item)
}

function normalizeCellText(text: string): string {
	return text
		.replace(/\r?\n/g, " ")
		.trim()
		.replace(/(^|[^\\])\|/g, "$1\\|")
}

export function normalizeMarkdownTableCellText(text: string): string {
	return normalizeCellText(text)
}

function padRow(row: readonly string[], columnCount: number): string[] {
	return Array.from({ length: columnCount }, (_, index) => normalizeCellText(row[index] ?? ""))
}

function delimiterForAlignment(alignment: TableCellAlignment): string {
	if (alignment === "center") return ":---:"
	if (alignment === "right") return "---:"
	return "---"
}

function formatTableRow(row: readonly string[]): string {
	return `| ${row.join(" | ")} |`
}

function formatDelimiterRow(
	alignments: readonly TableCellAlignment[],
	columnCount: number,
): string {
	const cells = Array.from({ length: columnCount }, (_, index) =>
		delimiterForAlignment(alignments[index] ?? "left"),
	)
	return formatTableRow(cells)
}

export function createMarkdownTable(
	sourceRows: readonly (readonly string[])[],
	alignments: readonly TableCellAlignment[] = [],
): string {
	const rowCount = Math.max(sourceRows.length, 1)
	const columnCount = Math.max(
		1,
		alignments.length,
		...sourceRows.map((row) => Math.max(row.length, 1)),
	)
	const rows = Array.from({ length: rowCount }, (_, index) =>
		padRow(sourceRows[index] ?? [], columnCount),
	)

	return [
		formatTableRow(rows[0]),
		formatDelimiterRow(alignments, columnCount),
		...rows.slice(1).map(formatTableRow),
	].join("\n")
}

function createReplacement(
	rows: readonly (readonly string[])[],
	alignments: readonly TableCellAlignment[],
	rowIndex: number,
	columnIndex: number,
): TableReplacement {
	const markdown = createMarkdownTable(rows, alignments)
	const lines = markdown.split("\n")
	const sourceLineIndex = rowIndex === 0 ? 0 : rowIndex + 1
	const lineOffset = lines
		.slice(0, sourceLineIndex)
		.reduce((offset, line) => offset + line.length + 1, 0)
	const row = parseTableLine({
		number: sourceLineIndex + 1,
		from: lineOffset,
		to: lineOffset + lines[sourceLineIndex].length,
		text: lines[sourceLineIndex],
	})
	const cell = row?.cells[columnIndex] ?? row?.cells.at(-1)

	return {
		markdown,
		selectionOffset: cell?.cursor ?? markdown.length,
	}
}

function dispatchTableReplacement(
	view: EditorRuntimeView,
	table: MarkdownTableContext,
	rows: readonly (readonly string[])[],
	alignments: readonly TableCellAlignment[],
	rowIndex: number,
	columnIndex: number,
): void {
	const replacement = createReplacement(rows, alignments, rowIndex, columnIndex)
	view.dispatch({
		changes: { from: table.from, to: table.to, insert: replacement.markdown },
		selection: { anchor: table.from + replacement.selectionOffset },
	})
}

export function replaceMarkdownTableRows(
	view: EditorRuntimeView,
	table: MarkdownTableContext,
	rows: readonly (readonly string[])[],
	alignments: readonly TableCellAlignment[],
	rowIndex: number,
	columnIndex: number,
): void {
	dispatchTableReplacement(view, table, rows, alignments, rowIndex, columnIndex)
}

function createTableInsertion(
	state: EditorRuntimeState,
	rows: readonly (readonly string[])[],
	alignments: readonly TableCellAlignment[],
	from: number,
	to = from,
): TableReplacement & { from: number; to: number } {
	const beforeNeedsBreak = from > 0 && state.sliceDoc(from - 1, from) !== "\n"
	const afterNeedsBreak = to < state.doc.length && state.sliceDoc(to, to + 1) !== "\n"
	const prefix = beforeNeedsBreak ? "\n\n" : ""
	const suffix = afterNeedsBreak ? "\n\n" : ""
	const replacement = createReplacement(rows, alignments, 0, 0)

	return {
		from,
		to,
		markdown: `${prefix}${replacement.markdown}${suffix}`,
		selectionOffset: prefix.length + replacement.selectionOffset,
	}
}

function getTableCell(
	table: MarkdownTableContext,
	rowIndex: number,
	columnIndex: number,
): MarkdownTableCell | null {
	const row = table.rows[Math.max(0, Math.min(rowIndex, table.rows.length - 1))]
	if (!row) return null
	return row.cells[Math.max(0, Math.min(columnIndex, table.columnCount - 1))] ?? null
}

function selectTableCell(
	view: EditorRuntimeView,
	table: MarkdownTableContext,
	rowIndex: number,
	columnIndex: number,
): boolean {
	const cell = getTableCell(table, rowIndex, columnIndex)
	if (!cell) return false
	view.dispatch({ selection: { anchor: cell.cursor } })
	return true
}

function getActiveTableCell(table: MarkdownTableContext): MarkdownTableCell | null {
	return getTableCell(table, table.activeRowIndex, table.activeColumnIndex)
}

function findActiveColumn(row: MarkdownTableRow, position: number): number {
	if (row.cells.length === 0) return 0
	for (let index = 0; index < row.cells.length; index++) {
		if (position <= row.cells[index].sourceTo) return index
	}
	return row.cells.length - 1
}

export function getMarkdownTableContext(
	state: EditorRuntimeState,
	position: number = state.selection.main.head,
): MarkdownTableContext | null {
	const currentLine = state.doc.lineAt(position)
	if (!isTableLikeLine(currentLine.text)) return null

	let topLineNumber = currentLine.number
	while (topLineNumber > 1 && isTableLikeLine(state.doc.line(topLineNumber - 1).text)) {
		topLineNumber--
	}

	let bottomLineNumber = currentLine.number
	while (
		bottomLineNumber < state.doc.lines &&
		isTableLikeLine(state.doc.line(bottomLineNumber + 1).text)
	) {
		bottomLineNumber++
	}

	let delimiterLineNumber = -1
	for (let lineNumber = topLineNumber + 1; lineNumber <= bottomLineNumber; lineNumber++) {
		const delimiter = parseDelimiterLine(getLine(state, lineNumber))
		if (delimiter && parseTableLine(getLine(state, lineNumber - 1))) {
			delimiterLineNumber = lineNumber
			break
		}
	}
	if (delimiterLineNumber < 0) return null

	const startLineNumber = delimiterLineNumber - 1
	let endLineNumber = delimiterLineNumber
	while (
		endLineNumber < state.doc.lines &&
		isTableLikeLine(state.doc.line(endLineNumber + 1).text)
	) {
		endLineNumber++
	}
	if (currentLine.number < startLineNumber || currentLine.number > endLineNumber) return null

	const delimiter = parseDelimiterLine(getLine(state, delimiterLineNumber))
	if (!delimiter) return null

	const rawRows = [
		parseTableLine(getLine(state, startLineNumber)),
		...Array.from({ length: endLineNumber - delimiterLineNumber }, (_, index) =>
			parseTableLine(getLine(state, delimiterLineNumber + index + 1)),
		),
	].filter((row): row is MarkdownTableRow => Boolean(row))
	const columnCount = Math.max(1, delimiter.cells.length, ...rawRows.map((row) => row.cells.length))
	const rows = rawRows.map((row) => parseTableLine(getLine(state, row.lineNumber), columnCount))
	const tableRows = rows.filter((row): row is MarkdownTableRow => Boolean(row))
	const alignments = Array.from({ length: columnCount }, (_, index) =>
		parseAlignment(delimiter.cells[index]?.text ?? "---"),
	)
	const activeRowIndex =
		currentLine.number <= delimiterLineNumber
			? 0
			: Math.min(tableRows.length - 1, currentLine.number - delimiterLineNumber)
	const activeLine =
		currentLine.number === delimiterLineNumber
			? getLine(state, startLineNumber)
			: getLine(state, currentLine.number)
	const activeRow = parseTableLine(activeLine, columnCount) ?? tableRows[activeRowIndex]
	const activeColumnIndex = findActiveColumn(activeRow, position)

	return {
		from: state.doc.line(startLineNumber).from,
		to: state.doc.line(endLineNumber).to,
		startLineNumber,
		delimiterLineNumber,
		endLineNumber,
		columnCount,
		rows: tableRows,
		alignments,
		activeRowIndex,
		activeColumnIndex,
	}
}

export function isSelectionInsideTable(view: EditorRuntimeView): boolean {
	return getMarkdownTableContext(view.state) !== null
}

function getTableContextAtLine(
	state: EditorRuntimeState,
	lineNumber: number,
): MarkdownTableContext | null {
	if (lineNumber < 1 || lineNumber > state.doc.lines) return null
	const line = state.doc.line(lineNumber)
	return isTableLikeLine(line.text) ? getMarkdownTableContext(state, line.from) : null
}

function moveToLineBoundaryFromTable(
	view: EditorRuntimeView,
	lineNumber: number,
	preferEnd: boolean,
): boolean {
	if (lineNumber < 1 || lineNumber > view.state.doc.lines) return false
	const line = view.state.doc.line(lineNumber)
	view.dispatch({ selection: { anchor: preferEnd ? line.to : line.from } })
	return true
}

export function createDefaultTableInsertion(
	state: EditorRuntimeState,
	from: number,
	to = from,
): TableReplacement & { from: number; to: number } {
	return createTableInsertion(state, defaultTableRows, [], from, to)
}

export function createStructuredTableInsertion(
	state: EditorRuntimeState,
	from: number,
	to = from,
): (TableReplacement & { from: number; to: number }) | null {
	const text = state.sliceDoc(from, to)
	if (!text.trim()) return null
	const parsed = parsePastedTableData(text, { allowPlainMultiline: true })
	return parsed ? createTableInsertion(state, parsed.rows, parsed.alignments, from, to) : null
}

function alignTableColumn(view: EditorRuntimeView, alignment: TableCellAlignment): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false

	const alignments = [...table.alignments]
	alignments[table.activeColumnIndex] = alignment
	dispatchTableReplacement(
		view,
		table,
		getRows(table),
		alignments,
		table.activeRowIndex,
		table.activeColumnIndex,
	)
	return true
}

export function alignTableColumnLeft(view: EditorRuntimeView): boolean {
	return alignTableColumn(view, "left")
}

export function alignTableColumnCenter(view: EditorRuntimeView): boolean {
	return alignTableColumn(view, "center")
}

export function alignTableColumnRight(view: EditorRuntimeView): boolean {
	return alignTableColumn(view, "right")
}

export function addTableRowAbove(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false

	const rows = getRows(table)
	rows.splice(
		table.activeRowIndex,
		0,
		Array.from({ length: table.columnCount }, () => ""),
	)
	dispatchTableReplacement(
		view,
		table,
		rows,
		table.alignments,
		table.activeRowIndex,
		table.activeColumnIndex,
	)
	return true
}

export function addTableRowBelow(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false

	const rows = getRows(table)
	const nextRowIndex = table.activeRowIndex + 1
	rows.splice(
		nextRowIndex,
		0,
		Array.from({ length: table.columnCount }, () => ""),
	)
	dispatchTableReplacement(
		view,
		table,
		rows,
		table.alignments,
		nextRowIndex,
		table.activeColumnIndex,
	)
	return true
}

export function addTableRowEnd(view: EditorRuntimeView, columnIndex?: number): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false

	const rows = getRows(table)
	const nextRowIndex = rows.length
	rows.push(Array.from({ length: table.columnCount }, () => ""))
	dispatchTableReplacement(
		view,
		table,
		rows,
		table.alignments,
		nextRowIndex,
		Math.max(0, Math.min(columnIndex ?? table.activeColumnIndex, table.columnCount - 1)),
	)
	return true
}

export function addTableColumnLeft(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false

	const rows = getRows(table)
	for (const row of rows) row.splice(table.activeColumnIndex, 0, "")
	const alignments = [...table.alignments]
	alignments.splice(table.activeColumnIndex, 0, "left")
	dispatchTableReplacement(
		view,
		table,
		rows,
		alignments,
		table.activeRowIndex,
		table.activeColumnIndex,
	)
	return true
}

export function addTableColumnRight(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false

	const rows = getRows(table)
	const nextColumnIndex = table.activeColumnIndex + 1
	for (const row of rows) row.splice(nextColumnIndex, 0, "")
	const alignments = [...table.alignments]
	alignments.splice(nextColumnIndex, 0, "left")
	dispatchTableReplacement(view, table, rows, alignments, table.activeRowIndex, nextColumnIndex)
	return true
}

export function addTableColumnEnd(view: EditorRuntimeView, rowIndex?: number): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false

	const rows = getRows(table)
	const nextColumnIndex = table.columnCount
	for (const row of rows) row.push("")
	const alignments = [...table.alignments]
	alignments.push("left")
	dispatchTableReplacement(
		view,
		table,
		rows,
		alignments,
		Math.max(0, Math.min(rowIndex ?? table.activeRowIndex, table.rows.length - 1)),
		nextColumnIndex,
	)
	return true
}

export function deleteTableRow(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table || table.rows.length <= 1) return false

	const rows = getRows(table)
	rows.splice(table.activeRowIndex, 1)
	const nextRowIndex = Math.min(table.activeRowIndex, rows.length - 1)
	dispatchTableReplacement(
		view,
		table,
		rows,
		table.alignments,
		nextRowIndex,
		table.activeColumnIndex,
	)
	return true
}

export function deleteTableColumn(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table || table.columnCount <= 1) return false

	const rows = getRows(table)
	for (const row of rows) row.splice(table.activeColumnIndex, 1)
	const alignments = [...table.alignments]
	alignments.splice(table.activeColumnIndex, 1)
	const nextColumnIndex = Math.min(table.activeColumnIndex, table.columnCount - 2)
	dispatchTableReplacement(view, table, rows, alignments, table.activeRowIndex, nextColumnIndex)
	return true
}

export function duplicateTableRow(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false

	const rows = getRows(table)
	rows.splice(table.activeRowIndex + 1, 0, [...rows[table.activeRowIndex]])
	dispatchTableReplacement(
		view,
		table,
		rows,
		table.alignments,
		table.activeRowIndex + 1,
		table.activeColumnIndex,
	)
	return true
}

export function duplicateTableColumn(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false

	const rows = getRows(table)
	const nextColumnIndex = table.activeColumnIndex + 1
	for (const row of rows) row.splice(nextColumnIndex, 0, row[table.activeColumnIndex] ?? "")
	const alignments = [...table.alignments]
	alignments.splice(nextColumnIndex, 0, table.alignments[table.activeColumnIndex] ?? "left")
	dispatchTableReplacement(view, table, rows, alignments, table.activeRowIndex, nextColumnIndex)
	return true
}

export function moveTableRowUp(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table || table.activeRowIndex <= 0) return false
	return moveTableRowToIndex(view, table.activeRowIndex, table.activeRowIndex - 1)
}

export function moveTableRowToIndex(
	view: EditorRuntimeView,
	sourceRowIndex: number,
	targetRowIndex: number,
): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false
	const fromIndex = Math.max(0, Math.min(sourceRowIndex, table.rows.length - 1))
	const toIndex = Math.max(0, Math.min(targetRowIndex, table.rows.length - 1))
	if (fromIndex <= 0 || toIndex <= 0 || fromIndex === toIndex) return false

	const rows = getRows(table)
	moveItem(rows, fromIndex, toIndex)
	dispatchTableReplacement(view, table, rows, table.alignments, toIndex, table.activeColumnIndex)
	return true
}

export function moveTableRowDown(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table || table.activeRowIndex + 1 >= table.rows.length) return false
	return moveTableRowToIndex(view, table.activeRowIndex, table.activeRowIndex + 1)
}

export function moveTableColumnLeft(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table || table.activeColumnIndex <= 0) return false
	return moveTableColumnToIndex(view, table.activeColumnIndex, table.activeColumnIndex - 1)
}

export function moveTableColumnToIndex(
	view: EditorRuntimeView,
	sourceColumnIndex: number,
	targetColumnIndex: number,
): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false
	const fromIndex = Math.max(0, Math.min(sourceColumnIndex, table.columnCount - 1))
	const toIndex = Math.max(0, Math.min(targetColumnIndex, table.columnCount - 1))
	if (fromIndex === toIndex) return false

	const rows = getRows(table)
	for (const row of rows) moveItem(row, fromIndex, toIndex)
	const alignments = [...table.alignments]
	moveItem(alignments, fromIndex, toIndex)
	dispatchTableReplacement(view, table, rows, alignments, table.activeRowIndex, toIndex)
	return true
}

export function moveTableColumnRight(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table || table.activeColumnIndex + 1 >= table.columnCount) return false
	return moveTableColumnToIndex(view, table.activeColumnIndex, table.activeColumnIndex + 1)
}

export function clearTableCell(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false

	const rows = getRows(table)
	rows[table.activeRowIndex][table.activeColumnIndex] = ""
	dispatchTableReplacement(
		view,
		table,
		rows,
		table.alignments,
		table.activeRowIndex,
		table.activeColumnIndex,
	)
	return true
}

export function deleteTable(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false

	view.dispatch({
		changes: { from: table.from, to: table.to, insert: "" },
		selection: { anchor: table.from },
	})
	return true
}

function tableCellTextForTsv(text: string): string {
	return text.replace(/\\\|/g, "|").replace(/\t/g, " ").replace(/\r?\n/g, " ")
}

function serializeRowsAsTsv(rows: readonly (readonly string[])[]): string {
	return rows.map((row) => row.map(tableCellTextForTsv).join("\t")).join("\n")
}

export function serializeMarkdownTableRowsAsTsv(rows: readonly (readonly string[])[]): string {
	return serializeRowsAsTsv(rows)
}

function writeClipboardText(text: string): boolean {
	const writeText = globalThis.navigator?.clipboard?.writeText
	if (!writeText) return false
	void Promise.resolve(writeText.call(globalThis.navigator.clipboard, text)).catch(() => {})
	return true
}

export function writeMarkdownTableClipboardText(text: string): boolean {
	return writeClipboardText(text)
}

export function copyTableMarkdown(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false
	return writeClipboardText(createMarkdownTable(getRows(table), table.alignments))
}

export function copyTableTsv(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false
	return writeClipboardText(serializeRowsAsTsv(getRows(table)))
}

export function copyTableRowTsv(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false
	return writeClipboardText(serializeRowsAsTsv([getRows(table)[table.activeRowIndex]]))
}

export function copyTableColumnTsv(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false
	const rows = getRows(table).map((row) => [row[table.activeColumnIndex] ?? ""])
	return writeClipboardText(serializeRowsAsTsv(rows))
}

function moveToNextTableCell(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false
	if (moveToNextExistingTableCell(view, table)) return true

	const rows = getRows(table)
	const nextRowIndex = rows.length
	rows.push(Array.from({ length: table.columnCount }, () => ""))
	dispatchTableReplacement(view, table, rows, table.alignments, nextRowIndex, 0)
	return true
}

function moveToNextExistingTableCell(
	view: EditorRuntimeView,
	table: MarkdownTableContext,
): boolean {
	if (table.activeColumnIndex + 1 < table.columnCount) {
		const cell = table.rows[table.activeRowIndex].cells[table.activeColumnIndex + 1]
		view.dispatch({ selection: { anchor: cell.cursor } })
		return true
	}

	if (table.activeRowIndex + 1 < table.rows.length) {
		const cell = table.rows[table.activeRowIndex + 1].cells[0]
		view.dispatch({ selection: { anchor: cell.cursor } })
		return true
	}

	return false
}

function moveToPreviousTableCell(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false
	return moveToPreviousExistingTableCell(view, table)
}

function moveToPreviousExistingTableCell(
	view: EditorRuntimeView,
	table: MarkdownTableContext,
): boolean {
	if (table.activeColumnIndex > 0) {
		const cell = table.rows[table.activeRowIndex].cells[table.activeColumnIndex - 1]
		view.dispatch({ selection: { anchor: cell.cursor } })
		return true
	}

	if (table.activeRowIndex > 0) {
		const cell = table.rows[table.activeRowIndex - 1].cells[table.columnCount - 1]
		view.dispatch({ selection: { anchor: cell.cursor } })
		return true
	}

	return false
}

function moveArrowLeftThroughTable(view: EditorRuntimeView): boolean {
	if (!view.state.selection.main.empty) return false

	const table = getMarkdownTableContext(view.state)
	if (!table) return false
	const cell = getActiveTableCell(table)
	if (!cell) return false

	const position = view.state.selection.main.head
	const isAtCellStart = cell.contentFrom === cell.contentTo || position <= cell.contentFrom
	if (!isAtCellStart) return false

	moveToPreviousExistingTableCell(view, table)
	return true
}

function moveArrowRightThroughTable(view: EditorRuntimeView): boolean {
	if (!view.state.selection.main.empty) return false

	const table = getMarkdownTableContext(view.state)
	if (!table) return false
	const cell = getActiveTableCell(table)
	if (!cell) return false

	const position = view.state.selection.main.head
	const isAtCellEnd = cell.contentFrom === cell.contentTo || position >= cell.contentTo
	if (!isAtCellEnd) return false

	moveToNextExistingTableCell(view, table)
	return true
}

function moveVimLeftThroughTable(view: EditorRuntimeView): boolean {
	if (!view.state.selection.main.empty) return false

	const table = getMarkdownTableContext(view.state)
	if (!table) return false
	const cell = getActiveTableCell(table)
	if (!cell) return false

	const position = view.state.selection.main.head
	const isAtCellStart = cell.contentFrom === cell.contentTo || position <= cell.contentFrom
	if (!isAtCellStart) return false

	moveToPreviousExistingTableCell(view, table)
	return true
}

function moveVimRightThroughTable(view: EditorRuntimeView): boolean {
	if (!view.state.selection.main.empty) return false

	const table = getMarkdownTableContext(view.state)
	if (!table) return false
	const cell = getActiveTableCell(table)
	if (!cell) return false

	const position = view.state.selection.main.head
	const lastCharacterPosition = Math.max(cell.contentFrom, cell.contentTo - 1)
	const isAtCellEnd = cell.contentFrom === cell.contentTo || position >= lastCharacterPosition
	if (!isAtCellEnd) return false

	moveToNextExistingTableCell(view, table)
	return true
}

function moveToNextTableRow(view: EditorRuntimeView): boolean {
	const table = getMarkdownTableContext(view.state)
	if (!table) return false

	if (table.activeRowIndex + 1 < table.rows.length) {
		return selectTableCell(view, table, table.activeRowIndex + 1, table.activeColumnIndex)
	}

	return addTableRowBelow(view)
}

export function moveArrowDownThroughTable(view: EditorRuntimeView): boolean {
	if (!view.state.selection.main.empty) return false

	const table = getMarkdownTableContext(view.state)
	if (table) {
		if (table.activeRowIndex + 1 < table.rows.length) {
			return selectTableCell(view, table, table.activeRowIndex + 1, table.activeColumnIndex)
		}
		return moveToLineBoundaryFromTable(view, table.endLineNumber + 1, false)
	}

	const currentLine = view.state.doc.lineAt(view.state.selection.main.head)
	const nextTable = getTableContextAtLine(view.state, currentLine.number + 1)
	if (!nextTable || nextTable.startLineNumber !== currentLine.number + 1) return false
	return selectTableCell(view, nextTable, 0, 0)
}

export function moveArrowUpThroughTable(view: EditorRuntimeView): boolean {
	if (!view.state.selection.main.empty) return false

	const table = getMarkdownTableContext(view.state)
	if (table) {
		if (table.activeRowIndex > 0) {
			return selectTableCell(view, table, table.activeRowIndex - 1, table.activeColumnIndex)
		}
		return moveToLineBoundaryFromTable(view, table.startLineNumber - 1, true)
	}

	const currentLine = view.state.doc.lineAt(view.state.selection.main.head)
	const previousTable = getTableContextAtLine(view.state, currentLine.number - 1)
	if (!previousTable || previousTable.endLineNumber !== currentLine.number - 1) return false
	return selectTableCell(view, previousTable, previousTable.rows.length - 1, 0)
}

function insertTextIntoTableCell(view: EditorRuntimeView, event: InputEvent): boolean {
	if (event.defaultPrevented || !getMarkdownTableContext(view.state)) return false
	if (event.inputType !== "insertText" && event.inputType !== "insertCompositionText") {
		return false
	}
	const text = event.data
	if (!text) return false

	const { from, to } = view.state.selection.main
	event.preventDefault()
	view.dispatch({
		changes: { from, to, insert: text },
		selection: { anchor: from + text.length },
	})
	return true
}

function parseMarkdownPastedTable(lines: readonly string[]): ParsedPastedTable | null {
	if (lines.length < 2 || !isTableLikeLine(lines[0])) return null
	const delimiter = parseDelimiterLine({ number: 2, from: 0, to: lines[1].length, text: lines[1] })
	if (!delimiter) return null

	const parsedRows = [lines[0], ...lines.slice(2).filter(isTableLikeLine)].map((line, index) =>
		parseTableLine({ number: index + 1, from: 0, to: line.length, text: line }),
	)
	const rows = parsedRows.filter((row): row is MarkdownTableRow => Boolean(row))
	return rows.length > 0
		? {
				rows: rows.map((row) => row.cells.map((cell) => cell.text)),
				alignments: delimiter.cells.map((cell) => parseAlignment(cell.text)),
			}
		: null
}

export function parsePastedTableData(
	text: string,
	{ allowPlainMultiline = false }: { allowPlainMultiline?: boolean } = {},
): ParsedPastedTable | null {
	const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
	const lines = normalized.split("\n")
	while (lines.at(-1) === "") lines.pop()
	if (lines.length === 0) return null

	const markdownRows = parseMarkdownPastedTable(lines)
	if (markdownRows) return markdownRows

	if (normalized.includes("\t")) {
		return {
			rows: lines.map((line) => line.split("\t").map(normalizeCellText)),
			alignments: [],
		}
	}

	if (allowPlainMultiline && lines.length > 1) {
		return {
			rows: lines.map((line) => [normalizeCellText(line)]),
			alignments: [],
		}
	}

	return null
}

export function parsePastedTableText(
	text: string,
	{ allowPlainMultiline = false }: { allowPlainMultiline?: boolean } = {},
): string[][] | null {
	return parsePastedTableData(text, { allowPlainMultiline })?.rows ?? null
}

export function pasteTableText(view: EditorRuntimeView, text: string): boolean {
	const table = getMarkdownTableContext(view.state)
	const pastedTable = parsePastedTableData(text, { allowPlainMultiline: Boolean(table) })
	if (!pastedTable) return false
	const pastedRows = pastedTable.rows

	if (!table) {
		const { from, to } = view.state.selection.main
		const markdown = createMarkdownTable(pastedRows, pastedTable.alignments)
		const beforeNeedsBreak = from > 0 && view.state.sliceDoc(from - 1, from) !== "\n"
		const afterNeedsBreak = to < view.state.doc.length && view.state.sliceDoc(to, to + 1) !== "\n"
		const prefix = beforeNeedsBreak ? "\n\n" : ""
		const suffix = afterNeedsBreak ? "\n\n" : ""
		const insertedMarkdown = `${prefix}${markdown}${suffix}`
		view.dispatch({
			changes: { from, to, insert: insertedMarkdown },
			selection: { anchor: from + prefix.length + markdown.length },
		})
		return true
	}

	const rows = getRows(table)
	const pastedColumnCount = Math.max(...pastedRows.map((row) => row.length))
	const requiredColumnCount = Math.max(
		table.columnCount,
		table.activeColumnIndex + pastedColumnCount,
	)
	while (rows.length < table.activeRowIndex + pastedRows.length) {
		rows.push(Array.from({ length: table.columnCount }, () => ""))
	}
	for (const row of rows) {
		while (row.length < requiredColumnCount) row.push("")
	}
	const alignments = [...table.alignments]
	while (alignments.length < requiredColumnCount) alignments.push("left")
	pastedTable.alignments.forEach((alignment, index) => {
		const columnIndex = table.activeColumnIndex + index
		if (columnIndex < alignments.length) alignments[columnIndex] = alignment
	})

	pastedRows.forEach((pastedRow, rowOffset) => {
		pastedRow.forEach((cell, columnOffset) => {
			rows[table.activeRowIndex + rowOffset][table.activeColumnIndex + columnOffset] =
				normalizeCellText(cell)
		})
	})

	dispatchTableReplacement(
		view,
		table,
		rows,
		alignments,
		table.activeRowIndex + pastedRows.length - 1,
		table.activeColumnIndex + (pastedRows.at(-1)?.length ?? 1) - 1,
	)
	return true
}

function isPlainVimNavigationKey(event: KeyboardEvent): boolean {
	return (
		!event.altKey &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.shiftKey &&
		(event.key === "h" || event.key === "j" || event.key === "k" || event.key === "l")
	)
}

function getVimModeState(
	runtime: EditorRuntimeModules,
	view: EditorRuntimeView,
): VimModeState | null {
	const vimEditor = runtime.vim.getCM(view)
	return (vimEditor as { state?: { vim?: VimModeState } } | null)?.state?.vim ?? null
}

function isVimNormalMode(runtime: EditorRuntimeModules, view: EditorRuntimeView): boolean {
	const vimState = getVimModeState(runtime, view)
	return Boolean(vimState && !vimState.exMode && !vimState.insertMode && !vimState.visualMode)
}

function handleVimTableNavigation(
	runtime: EditorRuntimeModules,
	view: EditorRuntimeView,
	event: KeyboardEvent,
): boolean {
	if (event.defaultPrevented || !isPlainVimNavigationKey(event)) return false
	if (!isVimNormalMode(runtime, view)) return false

	const handled =
		event.key === "h"
			? moveVimLeftThroughTable(view)
			: event.key === "l"
				? moveVimRightThroughTable(view)
				: event.key === "j"
					? moveArrowDownThroughTable(view)
					: moveArrowUpThroughTable(view)
	if (!handled) return false

	event.preventDefault()
	return true
}

export function vimTableNavigationExtension(runtime: EditorRuntimeModules) {
	return runtime.state.Prec.highest(
		runtime.view.EditorView.domEventHandlers({
			keydown(event: KeyboardEvent, view: EditorRuntimeView) {
				return handleVimTableNavigation(runtime, view, event)
			},
		}),
	)
}

export function tableEditingExtension(runtime: EditorRuntimeModules) {
	return [
		runtime.state.Prec.high(
			runtime.view.keymap.of([
				{ key: "Tab", run: moveToNextTableCell },
				{ key: "Shift-Tab", run: moveToPreviousTableCell },
				{ key: "Enter", run: moveToNextTableRow },
				{ key: "ArrowDown", run: moveArrowDownThroughTable },
				{ key: "ArrowUp", run: moveArrowUpThroughTable },
				{ key: "ArrowLeft", run: moveArrowLeftThroughTable },
				{ key: "ArrowRight", run: moveArrowRightThroughTable },
			]),
		),
		runtime.view.EditorView.domEventHandlers({
			beforeinput(event: InputEvent, view: EditorRuntimeView) {
				return insertTextIntoTableCell(view, event)
			},
			paste(event: ClipboardEvent, view: EditorRuntimeView) {
				const text = event.clipboardData?.getData("text/plain")
				if (!text || !pasteTableText(view, text)) return false
				event.preventDefault()
				return true
			},
		}),
	]
}
