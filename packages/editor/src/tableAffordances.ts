import {
	addTableColumnEnd,
	addTableRowEnd,
	moveTableColumnToIndex,
	moveTableRowToIndex,
} from "./tableEditing"
import {
	findCellInRowFromX,
	findEditableTableCell,
	findRowInWrapperFromY,
	getEditableCellsInRow,
	getEditableRowsInWrapper,
	getPointerCoordinates,
	hasMeasuredRect,
	isWithinRange,
	parseDatasetInteger,
	type TablePointerCoordinates,
} from "./tablePointer"
import { hasTableVisualSelection } from "./tableSelection"
import type {
	EditorRuntimeExtension,
	EditorRuntimeModules,
	EditorRuntimeView,
	EditorRuntimeViewUpdate,
} from "./types"

type TableAffordanceKind = "row" | "column"
type TableRowKind = "header" | "body"

interface TableAffordanceTarget {
	cell: HTMLElement
	row: HTMLElement
	wrapper: HTMLElement
	cursor: number
	rowIndex: number
	columnIndex: number
	rowKind: TableRowKind
	showRowHandle: boolean
	showColumnHandle: boolean
}

interface TableAddTarget {
	kind: TableAffordanceKind
	cell: HTMLElement
	row: HTMLElement
	wrapper: HTMLElement
	cursor: number
	rowIndex: number
	columnIndex: number
}

interface TableDragState {
	kind: TableAffordanceKind
	source: TableAffordanceTarget
	target: TableAffordanceTarget | null
}

interface HandleVisibility {
	row: boolean
	column: boolean
}

const handleSize = 16
const handleGap = 4
const handleTriggerDistance = 18
const handleTriggerOutset = handleSize + handleGap + 8
const addTriggerOutset = 18

function isCollapsedSelection(view: EditorRuntimeView): boolean {
	return view.state.selection.ranges.every((range) => range.from === range.to)
}

function getHandleVisibilityForCell(
	cell: HTMLElement,
	point: TablePointerCoordinates,
): HandleVisibility | null {
	const row = cell.closest<HTMLElement>("[data-table-row]")
	const wrapper = cell.closest<HTMLElement>(".cm-table-wrapper")
	if (!row || !wrapper) return null

	const cellRect = cell.getBoundingClientRect()
	const rowRect = row.getBoundingClientRect()
	const wrapperRect = wrapper.getBoundingClientRect()
	if (!hasMeasuredRect(cellRect) || !hasMeasuredRect(rowRect) || !hasMeasuredRect(wrapperRect)) {
		return { row: row.dataset.tableRowKind === "body", column: true }
	}

	const rowZone =
		row.dataset.tableRowKind === "body" &&
		isWithinRange(
			point.x,
			rowRect.left - handleTriggerOutset,
			rowRect.left + handleTriggerDistance,
		) &&
		isWithinRange(point.y, rowRect.top - 2, rowRect.bottom + 2)
	const columnZone =
		isWithinRange(point.x, cellRect.left - 2, cellRect.right + 2) &&
		isWithinRange(
			point.y,
			wrapperRect.top - handleTriggerOutset,
			wrapperRect.top + handleTriggerDistance,
		)

	return rowZone || columnZone ? { row: rowZone, column: columnZone } : null
}

function createTargetFromCell(
	cell: HTMLElement,
	visibility: HandleVisibility = { row: false, column: true },
): TableAffordanceTarget | null {
	const row = cell.closest<HTMLElement>("[data-table-row]")
	const wrapper = cell.closest<HTMLElement>(".cm-table-wrapper")
	if (!row || !wrapper) return null

	const rowKind = row.dataset.tableRowKind
	if (rowKind !== "header" && rowKind !== "body") return null

	const cursor = parseDatasetInteger(cell, "tableCellCursor")
	const rowIndex = parseDatasetInteger(cell, "tableCellRowIndex")
	const columnIndex = parseDatasetInteger(cell, "tableCellColumnIndex")
	if (cursor === null || rowIndex === null || columnIndex === null) return null

	return {
		cell,
		row,
		wrapper,
		cursor,
		rowIndex,
		columnIndex,
		rowKind,
		showRowHandle: rowKind === "body" && visibility.row,
		showColumnHandle: visibility.column,
	}
}

function createTargetFromPointer(
	view: EditorRuntimeView,
	event: MouseEvent,
	cellTarget: HTMLElement | null = null,
): TableAffordanceTarget | null {
	const point = getPointerCoordinates(event)
	if (!point) return cellTarget ? createTargetFromCell(cellTarget) : null

	if (cellTarget) {
		const visibility = getHandleVisibilityForCell(cellTarget, point)
		if (visibility) return createTargetFromCell(cellTarget, visibility)
	}

	for (const wrapper of Array.from(view.dom.querySelectorAll<HTMLElement>(".cm-table-wrapper"))) {
		const wrapperRect = wrapper.getBoundingClientRect()
		if (!hasMeasuredRect(wrapperRect)) continue
		if (
			!isWithinRange(point.x, wrapperRect.left - handleTriggerOutset, wrapperRect.right + 2) ||
			!isWithinRange(point.y, wrapperRect.top - handleTriggerOutset, wrapperRect.bottom + 2)
		) {
			continue
		}

		const rows = getEditableRowsInWrapper(wrapper)
		const firstRow = rows[0]
		if (
			firstRow &&
			isWithinRange(
				point.y,
				wrapperRect.top - handleTriggerOutset,
				wrapperRect.top + handleTriggerDistance,
			)
		) {
			const cell = findCellInRowFromX(firstRow, point.x)
			if (cell) return createTargetFromCell(cell, { row: false, column: true })
		}

		for (const row of rows) {
			const rowRect = row.getBoundingClientRect()
			if (!hasMeasuredRect(rowRect)) continue
			if (!isWithinRange(point.y, rowRect.top - 2, rowRect.bottom + 2)) continue

			const cell = findCellInRowFromX(row, point.x)
			if (!cell) continue

			const visibility = getHandleVisibilityForCell(cell, point)
			if (visibility) return createTargetFromCell(cell, visibility)
		}
	}

	return null
}

function createDropTargetFromPointer(
	view: EditorRuntimeView,
	event: MouseEvent,
	kind: TableAffordanceKind,
): TableAffordanceTarget | null {
	const point = getPointerCoordinates(event)
	if (!point) return null

	for (const wrapper of Array.from(view.dom.querySelectorAll<HTMLElement>(".cm-table-wrapper"))) {
		const wrapperRect = wrapper.getBoundingClientRect()
		if (!hasMeasuredRect(wrapperRect)) continue
		if (
			!isWithinRange(point.x, wrapperRect.left - handleTriggerOutset, wrapperRect.right + 2) ||
			!isWithinRange(point.y, wrapperRect.top - handleTriggerOutset, wrapperRect.bottom + 2)
		) {
			continue
		}

		const rows = getEditableRowsInWrapper(wrapper)
		if (kind === "column") {
			const row = rows[0]
			const cell = row ? findCellInRowFromX(row, point.x) : null
			return cell ? createTargetFromCell(cell, { row: false, column: true }) : null
		}

		const row = findRowInWrapperFromY(wrapper, point.y)
		if (!row || row.dataset.tableRowKind !== "body") return null
		const cell = findCellInRowFromX(row, Math.max(point.x, wrapperRect.left))
		return cell ? createTargetFromCell(cell, { row: true, column: false }) : null
	}

	return null
}

function createAddTargetFromPointer(
	view: EditorRuntimeView,
	event: MouseEvent,
): TableAddTarget | null {
	const point = getPointerCoordinates(event)
	if (!point) return null

	for (const wrapper of Array.from(view.dom.querySelectorAll<HTMLElement>(".cm-table-wrapper"))) {
		const wrapperRect = wrapper.getBoundingClientRect()
		if (!hasMeasuredRect(wrapperRect)) continue

		const isRightEdge =
			isWithinRange(point.x, wrapperRect.right - 4, wrapperRect.right + addTriggerOutset) &&
			isWithinRange(point.y, wrapperRect.top - 2, wrapperRect.bottom + 2)
		if (isRightEdge) {
			const row = findRowInWrapperFromY(wrapper, point.y)
			const cell = row ? getEditableCellsInRow(row).at(-1) : null
			const target = cell ? createTargetFromCell(cell, { row: false, column: false }) : null
			if (target) return { ...target, kind: "column" }
		}

		const isBottomEdge =
			isWithinRange(point.y, wrapperRect.bottom - 4, wrapperRect.bottom + addTriggerOutset) &&
			isWithinRange(point.x, wrapperRect.left - 2, wrapperRect.right + 2)
		if (isBottomEdge) {
			const rows = getEditableRowsInWrapper(wrapper)
			const row = rows.at(-1) ?? null
			const cell = row ? findCellInRowFromX(row, point.x) : null
			const target = cell ? createTargetFromCell(cell, { row: false, column: false }) : null
			if (target) return { ...target, kind: "row" }
		}
	}

	return null
}

function createHandle(kind: TableAffordanceKind): HTMLButtonElement {
	const handle = document.createElement("button")
	handle.type = "button"
	handle.hidden = true
	handle.className = `cm-table-affordance-handle cm-table-affordance-${kind}-handle`
	handle.dataset.tableAffordanceHandle = kind
	handle.setAttribute("aria-label", kind === "row" ? "Drag row" : "Drag column")
	return handle
}

function createAddButton(kind: TableAffordanceKind): HTMLButtonElement {
	const button = document.createElement("button")
	button.type = "button"
	button.hidden = true
	button.className = `cm-table-affordance-add-button cm-table-affordance-add-${kind}`
	button.dataset.tableAffordanceAdd = kind
	button.textContent = "+"
	button.setAttribute("aria-label", kind === "column" ? "Add column to the right" : "Add row below")
	return button
}

function createDragLayerElement(className: string): HTMLDivElement {
	const element = document.createElement("div")
	element.hidden = true
	element.className = className
	element.setAttribute("aria-hidden", "true")
	return element
}

export function tableAffordancesExtension(runtime: EditorRuntimeModules): EditorRuntimeExtension {
	return runtime.view.ViewPlugin.fromClass(
		class {
			private readonly layer: HTMLDivElement
			private readonly rowHandle: HTMLButtonElement
			private readonly columnHandle: HTMLButtonElement
			private readonly addColumnButton: HTMLButtonElement
			private readonly addRowButton: HTMLButtonElement
			private readonly dragPreview: HTMLDivElement
			private readonly dropIndicator: HTMLDivElement
			private readonly highlightedElements = new Set<HTMLElement>()
			private target: TableAffordanceTarget | null = null
			private addTarget: TableAddTarget | null = null
			private drag: TableDragState | null = null

			constructor(readonly view: EditorRuntimeView) {
				this.layer = document.createElement("div")
				this.layer.className = "cm-table-affordance-layer"
				this.rowHandle = createHandle("row")
				this.columnHandle = createHandle("column")
				this.addColumnButton = createAddButton("column")
				this.addRowButton = createAddButton("row")
				this.dragPreview = createDragLayerElement("cm-table-affordance-drag-preview")
				this.dropIndicator = createDragLayerElement("cm-table-affordance-drop-indicator")
				this.layer.append(
					this.rowHandle,
					this.columnHandle,
					this.addColumnButton,
					this.addRowButton,
					this.dragPreview,
					this.dropIndicator,
				)
				this.view.dom.appendChild(this.layer)

				this.rowHandle.addEventListener("pointerdown", this.handleRowHandlePointerDown)
				this.columnHandle.addEventListener("pointerdown", this.handleColumnHandlePointerDown)
				this.addColumnButton.addEventListener("pointerdown", this.handleChromePointerDown)
				this.addRowButton.addEventListener("pointerdown", this.handleChromePointerDown)
				this.addColumnButton.addEventListener("click", this.handleAddColumnClick)
				this.addRowButton.addEventListener("click", this.handleAddRowClick)
				this.layer.addEventListener("pointerdown", this.handleChromePointerDown)
				this.view.dom.addEventListener("pointerover", this.handlePointerOver)
				this.view.dom.addEventListener("pointermove", this.handlePointerOver)
				this.view.dom.addEventListener("pointerleave", this.handlePointerLeave)
				this.view.dom.addEventListener("scroll", this.handleScroll, true)
				this.view.dom.ownerDocument.addEventListener(
					"pointermove",
					this.handleDocumentPointerMove,
					true,
				)
				this.view.dom.ownerDocument.addEventListener(
					"pointerup",
					this.handleDocumentPointerUp,
					true,
				)
				this.view.dom.ownerDocument.addEventListener("keydown", this.handleDocumentKeyDown, true)
			}

			update(update: EditorRuntimeViewUpdate) {
				if (update.docChanged) {
					this.clearTarget()
					return
				}
				if (!isCollapsedSelection(update.view) || hasTableVisualSelection(update.view)) {
					this.clearTarget()
					return
				}
				if (update.selectionSet) {
					if (!this.drag) this.clearTarget()
					return
				}
				if (this.target && !this.target.cell.isConnected) {
					this.clearTarget()
					return
				}
				if (this.addTarget && !this.addTarget.cell.isConnected) {
					this.clearAddTarget()
					return
				}
				this.positionAffordances()
			}

			destroy() {
				this.clearHighlights()
				this.rowHandle.removeEventListener("pointerdown", this.handleRowHandlePointerDown)
				this.columnHandle.removeEventListener("pointerdown", this.handleColumnHandlePointerDown)
				this.addColumnButton.removeEventListener("pointerdown", this.handleChromePointerDown)
				this.addRowButton.removeEventListener("pointerdown", this.handleChromePointerDown)
				this.addColumnButton.removeEventListener("click", this.handleAddColumnClick)
				this.addRowButton.removeEventListener("click", this.handleAddRowClick)
				this.layer.removeEventListener("pointerdown", this.handleChromePointerDown)
				this.view.dom.removeEventListener("pointerover", this.handlePointerOver)
				this.view.dom.removeEventListener("pointermove", this.handlePointerOver)
				this.view.dom.removeEventListener("pointerleave", this.handlePointerLeave)
				this.view.dom.removeEventListener("scroll", this.handleScroll, true)
				this.view.dom.ownerDocument.removeEventListener(
					"pointermove",
					this.handleDocumentPointerMove,
					true,
				)
				this.view.dom.ownerDocument.removeEventListener(
					"pointerup",
					this.handleDocumentPointerUp,
					true,
				)
				this.view.dom.ownerDocument.removeEventListener("keydown", this.handleDocumentKeyDown, true)
				this.layer.remove()
			}

			private readonly handlePointerOver = (event: Event) => {
				if (event.target instanceof Node && this.layer.contains(event.target)) return
				if (!isCollapsedSelection(this.view) || hasTableVisualSelection(this.view)) {
					this.clearTarget()
					return
				}
				if (!(event instanceof MouseEvent)) return

				const addTarget = createAddTargetFromPointer(this.view, event)
				if (addTarget) {
					this.setAddTarget(addTarget)
					return
				}

				const target = createTargetFromPointer(
					this.view,
					event,
					findEditableTableCell(event.target),
				)
				if (!target) {
					this.clearTarget()
					return
				}
				this.setTarget(target)
			}

			private readonly handlePointerLeave = (event: PointerEvent) => {
				if (this.drag) return
				if (event.relatedTarget instanceof Node && this.view.dom.contains(event.relatedTarget))
					return
				const addTarget = createAddTargetFromPointer(this.view, event)
				if (addTarget) {
					this.setAddTarget(addTarget)
					return
				}
				const target = createTargetFromPointer(this.view, event)
				if (target) {
					this.setTarget(target)
					return
				}
				this.clearTarget()
			}

			private readonly handleScroll = () => {
				this.clearTarget()
			}

			private readonly handleChromePointerDown = (event: Event) => {
				event.preventDefault()
				event.stopPropagation()
			}

			private readonly handleRowHandlePointerDown = (event: PointerEvent) => {
				if (!this.target || !this.target.showRowHandle || this.target.rowKind !== "body") return
				this.startDrag(event, "row", this.target)
			}

			private readonly handleColumnHandlePointerDown = (event: PointerEvent) => {
				if (!this.target || !this.target.showColumnHandle) return
				this.startDrag(event, "column", this.target)
			}

			private readonly handleAddColumnClick = (event: MouseEvent) => {
				event.preventDefault()
				event.stopPropagation()
				this.runAddAction("column")
			}

			private readonly handleAddRowClick = (event: MouseEvent) => {
				event.preventDefault()
				event.stopPropagation()
				this.runAddAction("row")
			}

			private readonly handleDocumentPointerMove = (event: PointerEvent) => {
				if (this.drag) {
					const target = createDropTargetFromPointer(this.view, event, this.drag.kind)
					this.drag.target = target
					this.target = target ?? this.drag.source
					this.applyHighlights()
					this.positionAffordances()
					event.preventDefault()
					return
				}
				if (event.target instanceof Node && this.layer.contains(event.target)) return
				if (!isCollapsedSelection(this.view) || hasTableVisualSelection(this.view)) {
					this.clearTarget()
					return
				}

				const addTarget = createAddTargetFromPointer(this.view, event)
				if (addTarget) {
					this.setAddTarget(addTarget)
					return
				}

				const target = createTargetFromPointer(
					this.view,
					event,
					findEditableTableCell(event.target),
				)
				if (target) {
					this.setTarget(target)
					return
				}
				if (!(event.target instanceof Node && this.view.dom.contains(event.target))) {
					this.clearTarget()
				}
			}

			private readonly handleDocumentPointerUp = (event: PointerEvent) => {
				if (!this.drag) return
				event.preventDefault()
				const drag = this.drag
				this.drag = null
				this.layer.classList.remove("is-dragging", "is-dragging-row", "is-dragging-column")
				this.runDragAction(drag)
				this.clearTarget()
			}

			private readonly handleDocumentKeyDown = (event: KeyboardEvent) => {
				if (event.key !== "Escape") return
				if (!this.drag && !this.target && !this.addTarget) return
				event.preventDefault()
				this.drag = null
				this.layer.classList.remove("is-dragging", "is-dragging-row", "is-dragging-column")
				this.clearTarget()
				this.view.focus()
			}

			private setTarget(target: TableAffordanceTarget | null) {
				if (!target) {
					this.clearTarget()
					return
				}
				this.addTarget = null
				this.target = target
				this.applyHighlights()
				this.positionAffordances()
			}

			private setAddTarget(target: TableAddTarget) {
				this.target = null
				this.addTarget = target
				this.clearHighlights()
				this.positionAffordances()
			}

			private clearTarget() {
				this.target = null
				this.drag = null
				this.layer.classList.remove(
					"is-active",
					"is-dragging",
					"is-dragging-row",
					"is-dragging-column",
				)
				this.clearAddTarget()
				this.clearHighlights()
				this.hideDragPreview()
				this.rowHandle.hidden = true
				this.columnHandle.hidden = true
			}

			private clearAddTarget() {
				this.addTarget = null
				this.addColumnButton.hidden = true
				this.addRowButton.hidden = true
			}

			private clearHighlights() {
				for (const element of this.highlightedElements) {
					element.classList.remove(
						"cm-table-affordance-row-target",
						"cm-table-affordance-column-target",
						"cm-table-affordance-drop-target",
						"cm-table-drag-source",
						"cm-table-drop-before",
						"cm-table-drop-after",
					)
				}
				this.highlightedElements.clear()
			}

			private applyHighlights() {
				this.clearHighlights()
				if (!this.target) return

				const drag = this.drag
				const isDragging = Boolean(drag)
				const dropClass = drag?.target
					? this.isDropAfter(drag.source, drag.target, drag.kind)
						? "cm-table-drop-after"
						: "cm-table-drop-before"
					: null
				if (this.target.showRowHandle || drag?.kind === "row") {
					this.target.row.classList.add(
						"cm-table-affordance-row-target",
						...(isDragging ? ["cm-table-affordance-drop-target"] : []),
						...(dropClass ? [dropClass] : []),
					)
					this.highlightedElements.add(this.target.row)
				}

				if (this.target.showColumnHandle || drag?.kind === "column") {
					const sourceColumnCells = drag?.source.wrapper.querySelectorAll<HTMLElement>(
						`.cm-table-cell:not(.cm-table-delimiter-cell)[data-table-cell-column-index="${drag.source.columnIndex}"]`,
					)
					if (sourceColumnCells) {
						for (const cell of sourceColumnCells) {
							cell.classList.add("cm-table-drag-source")
							this.highlightedElements.add(cell)
						}
					}
					const columnCells = this.target.wrapper.querySelectorAll<HTMLElement>(
						`.cm-table-cell:not(.cm-table-delimiter-cell)[data-table-cell-column-index="${this.target.columnIndex}"]`,
					)
					for (const cell of columnCells) {
						cell.classList.add(
							"cm-table-affordance-column-target",
							...(isDragging ? ["cm-table-affordance-drop-target"] : []),
							...(dropClass ? [dropClass] : []),
						)
						this.highlightedElements.add(cell)
					}
				}

				if (drag?.kind === "row") {
					drag.source.row.classList.add("cm-table-drag-source")
					this.highlightedElements.add(drag.source.row)
				}
			}

			private positionAffordances() {
				this.positionHandles()
				this.positionAddButtons()
				this.positionDragPreview()
			}

			private positionHandles() {
				if (!this.target) {
					this.rowHandle.hidden = true
					this.columnHandle.hidden = true
					this.layer.classList.toggle("is-active", Boolean(this.addTarget))
					return
				}

				const editorRect = this.view.dom.getBoundingClientRect()
				const rowRect = this.target.row.getBoundingClientRect()
				const cellRect = this.target.cell.getBoundingClientRect()
				const wrapperRect = this.target.wrapper.getBoundingClientRect()

				const showRowHandle = this.target.showRowHandle && !this.drag
				const showColumnHandle = this.target.showColumnHandle && !this.drag
				this.rowHandle.hidden = !showRowHandle
				this.columnHandle.hidden = !showColumnHandle
				this.layer.classList.toggle(
					"is-active",
					showRowHandle || showColumnHandle || Boolean(this.addTarget) || Boolean(this.drag),
				)

				this.rowHandle.style.left = `${rowRect.left - editorRect.left - handleSize - handleGap}px`
				this.rowHandle.style.top = `${rowRect.top - editorRect.top + (rowRect.height - handleSize) / 2}px`
				this.columnHandle.style.left = `${cellRect.left - editorRect.left + (cellRect.width - handleSize) / 2}px`
				this.columnHandle.style.top = `${wrapperRect.top - editorRect.top - handleSize - handleGap}px`
			}

			private positionAddButtons() {
				this.addColumnButton.hidden = this.addTarget?.kind !== "column"
				this.addRowButton.hidden = this.addTarget?.kind !== "row"
				if (!this.addTarget) return

				const editorRect = this.view.dom.getBoundingClientRect()
				const wrapperRect = this.addTarget.wrapper.getBoundingClientRect()
				const rowRect = this.addTarget.row.getBoundingClientRect()
				const cellRect = this.addTarget.cell.getBoundingClientRect()

				if (this.addTarget.kind === "column") {
					this.addColumnButton.style.left = `${wrapperRect.right - editorRect.left + handleGap}px`
					this.addColumnButton.style.top = `${rowRect.top - editorRect.top + (rowRect.height - handleSize) / 2}px`
					return
				}

				this.addRowButton.style.left = `${cellRect.left - editorRect.left + (cellRect.width - handleSize) / 2}px`
				this.addRowButton.style.top = `${wrapperRect.bottom - editorRect.top + handleGap}px`
			}

			private positionDragPreview() {
				const drag = this.drag
				const target = drag?.target
				if (!drag || !target) {
					this.hideDragPreview()
					return
				}

				const editorRect = this.view.dom.getBoundingClientRect()
				const wrapperRect = target.wrapper.getBoundingClientRect()
				const cellRect = target.cell.getBoundingClientRect()
				const rowRect = target.row.getBoundingClientRect()
				if (
					!hasMeasuredRect(editorRect) ||
					!hasMeasuredRect(wrapperRect) ||
					!hasMeasuredRect(cellRect) ||
					!hasMeasuredRect(rowRect)
				) {
					this.hideDragPreview()
					return
				}

				this.dragPreview.hidden = false
				this.dropIndicator.hidden = false
				this.dragPreview.classList.toggle("is-row", drag.kind === "row")
				this.dragPreview.classList.toggle("is-column", drag.kind === "column")
				this.dropIndicator.classList.toggle("is-row", drag.kind === "row")
				this.dropIndicator.classList.toggle("is-column", drag.kind === "column")

				if (drag.kind === "column") {
					const indicatorX = this.isDropAfter(drag.source, target, "column")
						? cellRect.right
						: cellRect.left
					this.setOverlayRect(
						this.dragPreview,
						cellRect.left - editorRect.left,
						wrapperRect.top - editorRect.top,
						cellRect.width,
						wrapperRect.height,
					)
					this.setOverlayRect(
						this.dropIndicator,
						indicatorX - editorRect.left,
						wrapperRect.top - editorRect.top,
						1,
						wrapperRect.height,
					)
					return
				}

				const indicatorY = this.isDropAfter(drag.source, target, "row")
					? rowRect.bottom
					: rowRect.top
				this.setOverlayRect(
					this.dragPreview,
					wrapperRect.left - editorRect.left,
					rowRect.top - editorRect.top,
					wrapperRect.width,
					rowRect.height,
				)
				this.setOverlayRect(
					this.dropIndicator,
					wrapperRect.left - editorRect.left,
					indicatorY - editorRect.top,
					wrapperRect.width,
					1,
				)
			}

			private hideDragPreview() {
				this.dragPreview.hidden = true
				this.dropIndicator.hidden = true
			}

			private setOverlayRect(
				element: HTMLElement,
				left: number,
				top: number,
				width: number,
				height: number,
			) {
				element.style.transform = `translate3d(${left}px, ${top}px, 0)`
				element.style.width = `${width}px`
				element.style.height = `${height}px`
			}

			private isDropAfter(
				source: TableAffordanceTarget,
				target: TableAffordanceTarget,
				kind: TableAffordanceKind,
			): boolean {
				return kind === "column"
					? source.columnIndex < target.columnIndex
					: source.rowIndex < target.rowIndex
			}

			private startDrag(
				event: PointerEvent,
				kind: TableAffordanceKind,
				source: TableAffordanceTarget,
			) {
				event.preventDefault()
				event.stopPropagation()
				this.clearAddTarget()
				this.drag = { kind, source, target: source }
				this.layer.classList.add("is-dragging", `is-dragging-${kind}`)
				this.applyHighlights()
				this.positionAffordances()
			}

			private runDragAction(drag: TableDragState) {
				const target = drag.target
				if (!target) return
				if (target.wrapper !== drag.source.wrapper) return
				this.view.dispatch({ selection: { anchor: drag.source.cursor } })
				if (drag.kind === "row") {
					void moveTableRowToIndex(this.view, drag.source.rowIndex, target.rowIndex)
				} else {
					void moveTableColumnToIndex(this.view, drag.source.columnIndex, target.columnIndex)
				}
				this.view.focus()
			}

			private runAddAction(kind: TableAffordanceKind) {
				if (!this.addTarget || this.addTarget.kind !== kind) return
				const target = this.addTarget
				this.view.dispatch({ selection: { anchor: target.cursor } })
				if (kind === "column") {
					void addTableColumnEnd(this.view, target.rowIndex)
				} else {
					void addTableRowEnd(this.view, target.columnIndex)
				}
				this.view.focus()
				this.clearTarget()
			}
		},
	)
}
