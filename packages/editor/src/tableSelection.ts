import {
	createMarkdownTable,
	deleteTable,
	getMarkdownTableContext,
	getMarkdownTableRows,
	type MarkdownTableContext,
	normalizeMarkdownTableCellText,
	parsePastedTableData,
	replaceMarkdownTableRows,
	serializeMarkdownTableRowsAsTsv,
	type TableCellAlignment,
	writeMarkdownTableClipboardText,
} from "./tableEditing"
import { parseDatasetInteger, resolveTableCellFromPointer } from "./tablePointer"
import type {
	EditorRuntimeExtension,
	EditorRuntimeModules,
	EditorRuntimeView,
	EditorRuntimeViewUpdate,
} from "./types"

export interface TableCellSelectionRange {
	kind: "cells"
	tableFrom: number
	tableTo: number
	anchorRowIndex: number
	anchorColumnIndex: number
	focusRowIndex: number
	focusColumnIndex: number
}

interface TableWholeSelectionRange {
	kind: "table"
	tableFrom: number
	tableTo: number
	cursor: number
}

type TableVisualSelectionRange = TableCellSelectionRange | TableWholeSelectionRange

interface TableCellSelectionBounds {
	rowFrom: number
	rowTo: number
	columnFrom: number
	columnTo: number
}

interface TableCellSelectionEndpoint {
	cell: HTMLElement
	tableFrom: number
	tableTo: number
	rowIndex: number
	columnIndex: number
	cursor: number
}

interface ActiveTableCellSelection {
	range: TableCellSelectionRange
	table: MarkdownTableContext
	bounds: TableCellSelectionBounds
}

interface ActiveTableWholeSelection {
	range: TableWholeSelectionRange
	table: MarkdownTableContext
	bounds: TableCellSelectionBounds
}

type ActiveTableVisualSelection = ActiveTableCellSelection | ActiveTableWholeSelection

interface PendingTablePointerSelection {
	anchor: TableCellSelectionEndpoint
	x: number
	y: number
	forceCells: boolean
}

const tableVisualSelections = new WeakMap<EditorRuntimeView, TableVisualSelectionRange>()
const dragStartDistance = 4

function createEndpointFromCell(
	view: EditorRuntimeView,
	cell: HTMLElement,
): TableCellSelectionEndpoint | null {
	const cursor = parseDatasetInteger(cell, "tableCellCursor")
	const rowIndex = parseDatasetInteger(cell, "tableCellRowIndex")
	const columnIndex = parseDatasetInteger(cell, "tableCellColumnIndex")
	if (cursor === null || rowIndex === null || columnIndex === null) return null

	const table = getMarkdownTableContext(view.state, cursor)
	if (!table) return null

	return {
		cell,
		tableFrom: table.from,
		tableTo: table.to,
		rowIndex,
		columnIndex,
		cursor,
	}
}

function createEndpointFromTablePosition(
	fallback: TableCellSelectionEndpoint,
	table: MarkdownTableContext,
	rowIndex: number,
	columnIndex: number,
): TableCellSelectionEndpoint | null {
	const row = table.rows[rowIndex]
	const cell = row?.cells[columnIndex]
	if (!cell) return null
	return {
		cell: fallback.cell,
		tableFrom: table.from,
		tableTo: table.to,
		rowIndex,
		columnIndex,
		cursor: cell.cursor,
	}
}

function normalizeRange(range: TableCellSelectionRange): TableCellSelectionBounds {
	return {
		rowFrom: Math.min(range.anchorRowIndex, range.focusRowIndex),
		rowTo: Math.max(range.anchorRowIndex, range.focusRowIndex),
		columnFrom: Math.min(range.anchorColumnIndex, range.focusColumnIndex),
		columnTo: Math.max(range.anchorColumnIndex, range.focusColumnIndex),
	}
}

function isRangeInTable(range: TableVisualSelectionRange, table: MarkdownTableContext): boolean {
	return range.tableFrom === table.from && range.tableTo === table.to
}

function getWholeTableBounds(table: MarkdownTableContext): TableCellSelectionBounds {
	return {
		rowFrom: 0,
		rowTo: Math.max(0, table.rows.length - 1),
		columnFrom: 0,
		columnTo: Math.max(0, table.columnCount - 1),
	}
}

function getActiveTableVisualSelection(view: EditorRuntimeView): ActiveTableVisualSelection | null {
	const range = tableVisualSelections.get(view)
	if (!range) return null

	const table = getMarkdownTableContext(view.state, range.tableFrom)
	if (!table || !isRangeInTable(range, table)) {
		tableVisualSelections.delete(view)
		return null
	}

	if (range.kind === "table") {
		return {
			range,
			table,
			bounds: getWholeTableBounds(table),
		}
	}
	return {
		range,
		table,
		bounds: normalizeRange(range),
	}
}

function getActiveTableCellSelection(view: EditorRuntimeView): ActiveTableCellSelection | null {
	const selection = getActiveTableVisualSelection(view)
	if (!selection || selection.range.kind !== "cells") return null
	return selection as ActiveTableCellSelection
}

function getActiveTableWholeSelection(view: EditorRuntimeView): ActiveTableWholeSelection | null {
	const selection = getActiveTableVisualSelection(view)
	if (!selection || selection.range.kind !== "table") return null
	return selection as ActiveTableWholeSelection
}

function clearRenderedSelectionClasses(view: EditorRuntimeView): void {
	for (const cell of view.dom.querySelectorAll<HTMLElement>(
		".cm-table-cell-selected, .cm-table-cell-selection-anchor",
	)) {
		cell.classList.remove("cm-table-cell-selected", "cm-table-cell-selection-anchor")
	}
	for (const wrapper of view.dom.querySelectorAll<HTMLElement>(".cm-table-selected")) {
		wrapper.classList.remove("cm-table-selected")
	}
}

function isCellInsideSelection(
	cell: HTMLElement,
	range: TableVisualSelectionRange,
	bounds: TableCellSelectionBounds,
): boolean {
	const rowIndex = parseDatasetInteger(cell, "tableCellRowIndex")
	const columnIndex = parseDatasetInteger(cell, "tableCellColumnIndex")
	const cursor = parseDatasetInteger(cell, "tableCellCursor")
	if (rowIndex === null || columnIndex === null || cursor === null) return false
	if (cursor < range.tableFrom || cursor > range.tableTo) return false
	return (
		rowIndex >= bounds.rowFrom &&
		rowIndex <= bounds.rowTo &&
		columnIndex >= bounds.columnFrom &&
		columnIndex <= bounds.columnTo
	)
}

function applyTableCellSelectionClasses(view: EditorRuntimeView): void {
	clearRenderedSelectionClasses(view)

	const selection = getActiveTableVisualSelection(view)
	if (!selection) {
		tableVisualSelections.delete(view)
		return
	}

	for (const cell of view.dom.querySelectorAll<HTMLElement>(
		".cm-table-cell:not(.cm-table-delimiter-cell)",
	)) {
		if (!isCellInsideSelection(cell, selection.range, selection.bounds)) continue
		cell.classList.add("cm-table-cell-selected")
		const wrapper = cell.closest<HTMLElement>(".cm-table-wrapper")
		if (selection.range.kind === "table") wrapper?.classList.add("cm-table-selected")
		if (selection.range.kind !== "cells") continue
		const rowIndex = parseDatasetInteger(cell, "tableCellRowIndex")
		const columnIndex = parseDatasetInteger(cell, "tableCellColumnIndex")
		if (
			rowIndex === selection.range.anchorRowIndex &&
			columnIndex === selection.range.anchorColumnIndex
		) {
			cell.classList.add("cm-table-cell-selection-anchor")
		}
	}
}

function setTableCellSelection(
	view: EditorRuntimeView,
	range: TableVisualSelectionRange | null,
): void {
	if (range) {
		tableVisualSelections.set(view, range)
	} else {
		tableVisualSelections.delete(view)
	}
	applyTableCellSelectionClasses(view)
}

function clearTableCellSelectionState(view: EditorRuntimeView): void {
	setTableCellSelection(view, null)
}

function createCellRangeFromEndpoints(
	anchor: TableCellSelectionEndpoint,
	focus: TableCellSelectionEndpoint,
): TableCellSelectionRange {
	return {
		kind: "cells",
		tableFrom: anchor.tableFrom,
		tableTo: anchor.tableTo,
		anchorRowIndex: anchor.rowIndex,
		anchorColumnIndex: anchor.columnIndex,
		focusRowIndex: focus.rowIndex,
		focusColumnIndex: focus.columnIndex,
	}
}

function selectionCoversWholeTable(
	range: TableCellSelectionRange,
	table: MarkdownTableContext,
): boolean {
	const bounds = normalizeRange(range)
	return (
		bounds.rowFrom === 0 &&
		bounds.columnFrom === 0 &&
		bounds.rowTo >= table.rows.length - 1 &&
		bounds.columnTo >= table.columnCount - 1
	)
}

function createVisualRangeFromEndpoints(
	view: EditorRuntimeView,
	anchor: TableCellSelectionEndpoint,
	focus: TableCellSelectionEndpoint,
	forceCells: boolean,
): TableVisualSelectionRange | null {
	if (anchor.tableFrom !== focus.tableFrom || anchor.tableTo !== focus.tableTo) return null

	const range = createCellRangeFromEndpoints(anchor, focus)
	const table = getMarkdownTableContext(view.state, anchor.cursor)
	if (!table || !isRangeInTable(range, table)) return range
	if (!forceCells && selectionCoversWholeTable(range, table)) {
		return {
			kind: "table",
			tableFrom: anchor.tableFrom,
			tableTo: anchor.tableTo,
			cursor: anchor.cursor,
		}
	}
	return range
}

function getSelectedRows(selection: ActiveTableCellSelection): string[][] {
	const rows = getMarkdownTableRows(selection.table)
	return rows
		.slice(selection.bounds.rowFrom, selection.bounds.rowTo + 1)
		.map((row) => row.slice(selection.bounds.columnFrom, selection.bounds.columnTo + 1))
}

function ensureTableShape(
	rows: string[][],
	alignments: TableCellAlignment[],
	rowCount: number,
	columnCount: number,
): void {
	while (rows.length < rowCount) {
		rows.push(Array.from({ length: columnCount }, () => ""))
	}
	for (const row of rows) {
		while (row.length < columnCount) row.push("")
	}
	while (alignments.length < columnCount) alignments.push("left")
}

function replaceSelectionWithStructuredRows(
	view: EditorRuntimeView,
	selection: ActiveTableCellSelection,
	pastedRows: readonly (readonly string[])[],
	pastedAlignments: readonly TableCellAlignment[],
): boolean {
	if (pastedRows.length === 0) return false

	const rows = getMarkdownTableRows(selection.table)
	const alignments = [...selection.table.alignments]
	const pastedColumnCount = Math.max(1, ...pastedRows.map((row) => row.length))
	const requiredRowCount = selection.bounds.rowFrom + pastedRows.length
	const requiredColumnCount = Math.max(
		selection.table.columnCount,
		selection.bounds.columnFrom + pastedColumnCount,
	)

	ensureTableShape(rows, alignments, requiredRowCount, requiredColumnCount)

	pastedAlignments.forEach((alignment, index) => {
		const columnIndex = selection.bounds.columnFrom + index
		if (columnIndex < alignments.length) alignments[columnIndex] = alignment
	})

	pastedRows.forEach((pastedRow, rowOffset) => {
		pastedRow.forEach((cell, columnOffset) => {
			rows[selection.bounds.rowFrom + rowOffset][selection.bounds.columnFrom + columnOffset] =
				normalizeMarkdownTableCellText(cell)
		})
	})

	clearTableCellSelectionState(view)
	replaceMarkdownTableRows(
		view,
		selection.table,
		rows,
		alignments,
		selection.bounds.rowFrom + pastedRows.length - 1,
		selection.bounds.columnFrom + pastedColumnCount - 1,
	)
	return true
}

function replaceSelectionWithPlainText(
	view: EditorRuntimeView,
	selection: ActiveTableCellSelection,
	text: string,
): boolean {
	const rows = getMarkdownTableRows(selection.table)
	const alignments = [...selection.table.alignments]
	const normalizedText = normalizeMarkdownTableCellText(text)

	ensureTableShape(rows, alignments, selection.table.rows.length, selection.table.columnCount)

	for (let rowIndex = selection.bounds.rowFrom; rowIndex <= selection.bounds.rowTo; rowIndex++) {
		for (
			let columnIndex = selection.bounds.columnFrom;
			columnIndex <= selection.bounds.columnTo;
			columnIndex++
		) {
			rows[rowIndex][columnIndex] = normalizedText
		}
	}

	clearTableCellSelectionState(view)
	replaceMarkdownTableRows(
		view,
		selection.table,
		rows,
		alignments,
		selection.bounds.rowFrom,
		selection.bounds.columnFrom,
	)
	return true
}

export function hasTableCellSelection(view: EditorRuntimeView): boolean {
	return getActiveTableCellSelection(view) !== null
}

export function hasTableVisualSelection(view: EditorRuntimeView): boolean {
	return getActiveTableVisualSelection(view) !== null
}

export function copyTableSelectionTsv(view: EditorRuntimeView): boolean {
	const selection = getActiveTableCellSelection(view)
	if (!selection) return false
	return writeMarkdownTableClipboardText(
		serializeMarkdownTableRowsAsTsv(getSelectedRows(selection)),
	)
}

function copyWholeTableSelectionMarkdown(view: EditorRuntimeView): boolean {
	const selection = getActiveTableWholeSelection(view)
	if (!selection) return false
	return writeMarkdownTableClipboardText(
		createMarkdownTable(getMarkdownTableRows(selection.table), selection.table.alignments),
	)
}

function deleteWholeTableSelection(view: EditorRuntimeView): boolean {
	const selection = getActiveTableWholeSelection(view)
	if (!selection) return false
	view.dispatch({ selection: { anchor: selection.range.cursor } })
	clearTableCellSelectionState(view)
	return deleteTable(view)
}

export function clearTableSelection(view: EditorRuntimeView): boolean {
	const selection = getActiveTableCellSelection(view)
	if (!selection) return false

	const rows = getMarkdownTableRows(selection.table)
	const alignments = [...selection.table.alignments]
	ensureTableShape(rows, alignments, selection.table.rows.length, selection.table.columnCount)

	for (let rowIndex = selection.bounds.rowFrom; rowIndex <= selection.bounds.rowTo; rowIndex++) {
		for (
			let columnIndex = selection.bounds.columnFrom;
			columnIndex <= selection.bounds.columnTo;
			columnIndex++
		) {
			rows[rowIndex][columnIndex] = ""
		}
	}

	clearTableCellSelectionState(view)
	replaceMarkdownTableRows(
		view,
		selection.table,
		rows,
		alignments,
		selection.bounds.rowFrom,
		selection.bounds.columnFrom,
	)
	return true
}

function pasteIntoTableSelection(view: EditorRuntimeView, text: string): boolean {
	const selection = getActiveTableCellSelection(view)
	if (!selection) return false

	const pastedTable = parsePastedTableData(text)
	if (pastedTable) {
		return replaceSelectionWithStructuredRows(
			view,
			selection,
			pastedTable.rows,
			pastedTable.alignments,
		)
	}

	return replaceSelectionWithPlainText(view, selection, text)
}

export function tableSelectionExtension(runtime: EditorRuntimeModules): EditorRuntimeExtension {
	return runtime.view.ViewPlugin.fromClass(
		class {
			private isDragging = false
			private suppressVisualSelectionUntilPointerUp = false
			private pendingSelection: PendingTablePointerSelection | null = null

			constructor(readonly view: EditorRuntimeView) {
				this.view.dom.addEventListener("pointerdown", this.handlePointerDown, true)
				this.view.dom.addEventListener("keydown", this.handleKeyDown, true)
				this.view.dom.addEventListener("copy", this.handleCopy, true)
				this.view.dom.addEventListener("paste", this.handlePaste, true)
				this.view.dom.ownerDocument.addEventListener("pointermove", this.handlePointerMove, true)
				this.view.dom.ownerDocument.addEventListener("pointerup", this.handlePointerUp, true)
			}

			update(update: EditorRuntimeViewUpdate) {
				if (update.docChanged || !update.state.selection.main.empty) {
					this.pendingSelection = null
					this.isDragging = false
					this.suppressVisualSelectionUntilPointerUp = false
					clearTableCellSelectionState(update.view)
					return
				}
				if (update.selectionSet && !getMarkdownTableContext(update.state)) {
					clearTableCellSelectionState(update.view)
					return
				}
				applyTableCellSelectionClasses(update.view)
			}

			destroy() {
				this.view.dom.removeEventListener("pointerdown", this.handlePointerDown, true)
				this.view.dom.removeEventListener("keydown", this.handleKeyDown, true)
				this.view.dom.removeEventListener("copy", this.handleCopy, true)
				this.view.dom.removeEventListener("paste", this.handlePaste, true)
				this.view.dom.ownerDocument.removeEventListener("pointermove", this.handlePointerMove, true)
				this.view.dom.ownerDocument.removeEventListener("pointerup", this.handlePointerUp, true)
				clearTableCellSelectionState(this.view)
			}

			private readonly handlePointerDown = (event: PointerEvent) => {
				if (event.defaultPrevented || event.button !== 0) return
				if (event.target instanceof Node && this.view.dom.contains(event.target)) {
					if ((event.target as Element).closest?.(".cm-table-affordance-layer")) return
				}

				const pointerTarget = resolveTableCellFromPointer(this.view, event)
				const endpoint = pointerTarget
					? createEndpointFromCell(this.view, pointerTarget.cell)
					: null
				if (!pointerTarget || !endpoint) {
					this.pendingSelection = null
					if (hasTableVisualSelection(this.view)) clearTableCellSelectionState(this.view)
					return
				}

				if (!event.shiftKey && pointerTarget.hitsText) {
					this.pendingSelection = null
					this.suppressVisualSelectionUntilPointerUp = true
					if (hasTableVisualSelection(this.view)) clearTableCellSelectionState(this.view)
					return
				}

				if (!event.shiftKey && hasTableVisualSelection(this.view)) {
					clearTableCellSelectionState(this.view)
					return
				}

				const anchor = this.getAnchorEndpoint(endpoint, event.shiftKey)
				this.pendingSelection = {
					anchor,
					x: event.clientX,
					y: event.clientY,
					forceCells: event.shiftKey,
				}

				if (event.shiftKey) {
					event.preventDefault()
					event.stopPropagation()
					this.isDragging = true
					this.extendSelection(anchor, endpoint, true)
				}
			}

			private readonly handlePointerMove = (event: PointerEvent) => {
				if (this.suppressVisualSelectionUntilPointerUp) return
				if (!this.isDragging && this.pendingSelection) {
					const endpoint = this.getEndpointFromPointer(event)
					if (!endpoint) return
					if (!this.shouldStartVisualDrag(this.pendingSelection, endpoint, event)) return

					event.preventDefault()
					event.stopPropagation()
					this.isDragging = true
					this.extendSelection(
						this.pendingSelection.anchor,
						endpoint,
						this.pendingSelection.forceCells,
					)
					return
				}
				if (!this.isDragging || !this.pendingSelection) return
				const endpoint = this.getEndpointFromPointer(event)
				if (!endpoint) return

				event.preventDefault()
				event.stopPropagation()
				this.extendSelection(
					this.pendingSelection.anchor,
					endpoint,
					this.pendingSelection.forceCells,
				)
			}

			private readonly handlePointerUp = () => {
				this.isDragging = false
				this.pendingSelection = null
				this.suppressVisualSelectionUntilPointerUp = false
			}

			private readonly handleKeyDown = (event: KeyboardEvent) => {
				if (!hasTableVisualSelection(this.view)) return

				if (event.key === "Escape") {
					event.preventDefault()
					event.stopPropagation()
					clearTableCellSelectionState(this.view)
					this.view.focus()
					return
				}

				if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
					if (copyWholeTableSelectionMarkdown(this.view) || copyTableSelectionTsv(this.view)) {
						event.preventDefault()
						event.stopPropagation()
					}
					return
				}

				if (event.key === "Delete" || event.key === "Backspace") {
					if (deleteWholeTableSelection(this.view) || clearTableSelection(this.view)) {
						event.preventDefault()
						event.stopPropagation()
					}
					return
				}

				if (
					event.key === "Tab" ||
					event.key === "Enter" ||
					event.key === "ArrowUp" ||
					event.key === "ArrowDown" ||
					event.key === "ArrowLeft" ||
					event.key === "ArrowRight"
				) {
					clearTableCellSelectionState(this.view)
				}
			}

			private readonly handleCopy = (event: ClipboardEvent) => {
				const visualSelection = getActiveTableVisualSelection(this.view)
				if (!visualSelection || !event.clipboardData) return
				const text =
					visualSelection.range.kind === "table"
						? createMarkdownTable(
								getMarkdownTableRows(visualSelection.table),
								visualSelection.table.alignments,
							)
						: serializeMarkdownTableRowsAsTsv(
								getSelectedRows(visualSelection as ActiveTableCellSelection),
							)
				event.clipboardData.setData("text/plain", text)
				event.preventDefault()
				event.stopPropagation()
			}

			private readonly handlePaste = (event: ClipboardEvent) => {
				if (!hasTableCellSelection(this.view)) return
				const text = event.clipboardData?.getData("text/plain")
				if (!text || !pasteIntoTableSelection(this.view, text)) return
				event.preventDefault()
				event.stopPropagation()
			}

			private getEndpointFromPointer(event: MouseEvent): TableCellSelectionEndpoint | null {
				const target = resolveTableCellFromPointer(this.view, event)
				return target ? createEndpointFromCell(this.view, target.cell) : null
			}

			private shouldStartVisualDrag(
				pending: PendingTablePointerSelection,
				endpoint: TableCellSelectionEndpoint,
				event: PointerEvent,
			): boolean {
				if (
					endpoint.tableFrom !== pending.anchor.tableFrom ||
					endpoint.tableTo !== pending.anchor.tableTo
				) {
					return false
				}
				if (
					endpoint.rowIndex !== pending.anchor.rowIndex ||
					endpoint.columnIndex !== pending.anchor.columnIndex
				) {
					return true
				}

				const distance = Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
				return pending.forceCells && distance >= dragStartDistance
			}

			private getAnchorEndpoint(
				endpoint: TableCellSelectionEndpoint,
				extendExistingSelection: boolean,
			): TableCellSelectionEndpoint {
				if (!extendExistingSelection) return endpoint

				const currentRange = tableVisualSelections.get(this.view)
				if (
					currentRange?.kind === "cells" &&
					currentRange.tableFrom === endpoint.tableFrom &&
					currentRange.tableTo === endpoint.tableTo
				) {
					const table = getMarkdownTableContext(this.view.state, endpoint.cursor)
					const anchor = table
						? createEndpointFromTablePosition(
								endpoint,
								table,
								currentRange.anchorRowIndex,
								currentRange.anchorColumnIndex,
							)
						: null
					if (anchor) return anchor
				}

				const activeTable = getMarkdownTableContext(this.view.state)
				if (activeTable?.from !== endpoint.tableFrom || activeTable.to !== endpoint.tableTo) {
					return endpoint
				}
				return (
					createEndpointFromTablePosition(
						endpoint,
						activeTable,
						activeTable.activeRowIndex,
						activeTable.activeColumnIndex,
					) ?? endpoint
				)
			}

			private extendSelection(
				anchor: TableCellSelectionEndpoint,
				endpoint: TableCellSelectionEndpoint,
				forceCells: boolean,
			): void {
				const range = createVisualRangeFromEndpoints(this.view, anchor, endpoint, forceCells)
				if (!range) return
				tableVisualSelections.set(this.view, range)
				this.view.dispatch({ selection: { anchor: endpoint.cursor } })
				applyTableCellSelectionClasses(this.view)
				this.view.focus()
			}
		},
	)
}
