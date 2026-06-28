import {
	getEditableCellsInRow,
	getEditableRowsInWrapper,
	getPointerCoordinates,
	hasMeasuredRect,
	isWithinRange,
	parseDatasetInteger,
} from "./tablePointer"
import { hasTableVisualSelection } from "./tableSelection"
import type {
	EditorRuntimeExtension,
	EditorRuntimeModules,
	EditorRuntimeView,
	EditorRuntimeViewUpdate,
} from "./types"

interface TableColumnResizeTarget {
	wrapper: HTMLElement
	columnIndex: number
	tableFrom: number
	edge: "left" | "right"
	edgeX: number
	width: number
}

interface ActiveTableColumnResize {
	target: TableColumnResizeTarget
	startX: number
	startWidth: number
	previousWidth: number | null
}

const columnResizeHandleWidth = 10
const columnResizeTriggerDistance = 5
const minimumColumnWidth = 48
const maximumColumnWidth = 720

function isCollapsedSelection(view: EditorRuntimeView): boolean {
	return view.state.selection.ranges.every((range) => range.from === range.to)
}

function clampColumnWidth(width: number): number {
	return Math.max(minimumColumnWidth, Math.min(maximumColumnWidth, Math.round(width)))
}

function getTableFrom(wrapper: HTMLElement): number | null {
	return parseDatasetInteger(wrapper, "tableFrom")
}

function getColumnIndex(cell: HTMLElement): number | null {
	return parseDatasetInteger(cell, "tableCellColumnIndex")
}

function findResizeTargetInWrapper(
	wrapper: HTMLElement,
	x: number,
	y: number,
): TableColumnResizeTarget | null {
	const tableFrom = getTableFrom(wrapper)
	if (tableFrom === null) return null

	const wrapperRect = wrapper.getBoundingClientRect()
	if (!hasMeasuredRect(wrapperRect)) return null
	if (!isWithinRange(y, wrapperRect.top - 2, wrapperRect.bottom + 2)) return null

	const rows = getEditableRowsInWrapper(wrapper)
	const row = rows[0] ?? null
	if (!row) return null

	const cells = getEditableCellsInRow(row)
	for (const cell of cells) {
		const rect = cell.getBoundingClientRect()
		if (!hasMeasuredRect(rect)) continue

		const columnIndex = getColumnIndex(cell)
		if (columnIndex === null) continue

		const rightDistance = Math.abs(x - rect.right)
		if (rightDistance <= columnResizeTriggerDistance) {
			return {
				wrapper,
				columnIndex,
				tableFrom,
				edge: "right",
				edgeX: rect.right,
				width: rect.width,
			}
		}

		const leftDistance = Math.abs(x - rect.left)
		if (columnIndex === 0 && leftDistance <= columnResizeTriggerDistance) {
			return {
				wrapper,
				columnIndex,
				tableFrom,
				edge: "left",
				edgeX: rect.left,
				width: rect.width,
			}
		}
	}

	return null
}

function findResizeTarget(
	view: EditorRuntimeView,
	event: MouseEvent,
): TableColumnResizeTarget | null {
	const point = getPointerCoordinates(event)
	if (!point) return null

	for (const wrapper of Array.from(view.dom.querySelectorAll<HTMLElement>(".cm-table-wrapper"))) {
		const wrapperRect = wrapper.getBoundingClientRect()
		if (!hasMeasuredRect(wrapperRect)) continue
		if (
			!isWithinRange(
				point.x,
				wrapperRect.left - columnResizeTriggerDistance,
				wrapperRect.right + columnResizeTriggerDistance,
			)
		) {
			continue
		}
		const target = findResizeTargetInWrapper(wrapper, point.x, point.y)
		if (target) return target
	}

	return null
}

function setElementRect(
	element: HTMLElement,
	left: number,
	top: number,
	width: number,
	height: number,
): void {
	element.style.transform = `translate3d(${left}px, ${top}px, 0)`
	element.style.width = `${width}px`
	element.style.height = `${height}px`
}

export function tableResizeExtension(runtime: EditorRuntimeModules): EditorRuntimeExtension {
	return runtime.view.ViewPlugin.fromClass(
		class {
			private readonly layer: HTMLDivElement
			private readonly handle: HTMLButtonElement
			private readonly widthsByTable = new Map<number, Map<number, number>>()
			private target: TableColumnResizeTarget | null = null
			private activeResize: ActiveTableColumnResize | null = null

			constructor(readonly view: EditorRuntimeView) {
				this.layer = document.createElement("div")
				this.layer.className = "cm-table-resize-layer"
				this.handle = document.createElement("button")
				this.handle.type = "button"
				this.handle.hidden = true
				this.handle.className = "cm-table-column-resize-handle"
				this.handle.setAttribute("aria-label", "Resize column")
				this.layer.appendChild(this.handle)
				this.view.dom.appendChild(this.layer)

				this.handle.addEventListener("pointerdown", this.handlePointerDown)
				this.handle.addEventListener("dblclick", this.handleDoubleClick)
				this.view.dom.addEventListener("pointermove", this.handleEditorPointerMove)
				this.view.dom.addEventListener("pointerleave", this.handleEditorPointerLeave)
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
					this.remapTableWidths(update)
					this.target = null
					this.activeResize = null
					this.hideHandle()
				}
				if (!isCollapsedSelection(update.view) || hasTableVisualSelection(update.view)) {
					this.target = null
					this.hideHandle()
				}
				this.applyColumnWidths()
				if (this.target?.wrapper.isConnected) this.positionHandle()
			}

			destroy() {
				this.handle.removeEventListener("pointerdown", this.handlePointerDown)
				this.handle.removeEventListener("dblclick", this.handleDoubleClick)
				this.view.dom.removeEventListener("pointermove", this.handleEditorPointerMove)
				this.view.dom.removeEventListener("pointerleave", this.handleEditorPointerLeave)
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
				this.clearColumnWidths()
				this.layer.remove()
			}

			private readonly handleEditorPointerMove = (event: PointerEvent) => {
				if (this.activeResize) return
				if (event.target instanceof Node && this.layer.contains(event.target)) return
				if (!isCollapsedSelection(this.view) || hasTableVisualSelection(this.view)) {
					this.target = null
					this.hideHandle()
					return
				}

				const target = findResizeTarget(this.view, event)
				this.target = target
				if (!target) {
					this.hideHandle()
					return
				}
				this.positionHandle()
			}

			private readonly handleEditorPointerLeave = (event: PointerEvent) => {
				if (this.activeResize) return
				if (event.relatedTarget instanceof Node && this.view.dom.contains(event.relatedTarget)) {
					return
				}
				this.target = null
				this.hideHandle()
			}

			private readonly handleScroll = () => {
				if (this.activeResize) return
				this.target = null
				this.hideHandle()
			}

			private readonly handlePointerDown = (event: PointerEvent) => {
				if (!this.target) return
				event.preventDefault()
				event.stopPropagation()

				const previousWidth =
					this.widthsByTable.get(this.target.tableFrom)?.get(this.target.columnIndex) ?? null
				this.activeResize = {
					target: this.target,
					startX: event.clientX,
					startWidth: this.target.width,
					previousWidth,
				}
				this.layer.classList.add("is-resizing")
				this.handle.setPointerCapture?.(event.pointerId)
			}

			private readonly handleDoubleClick = (event: MouseEvent) => {
				if (!this.target) return
				event.preventDefault()
				event.stopPropagation()
				this.deleteColumnWidth(this.target.tableFrom, this.target.columnIndex)
				this.applyColumnWidths()
				this.positionHandle()
			}

			private readonly handleDocumentPointerMove = (event: PointerEvent) => {
				if (!this.activeResize) return
				event.preventDefault()
				event.stopPropagation()

				const { target, startX, startWidth } = this.activeResize
				const delta = event.clientX - startX
				const width =
					target.edge === "left"
						? clampColumnWidth(startWidth - delta)
						: clampColumnWidth(startWidth + delta)
				this.setColumnWidth(target.tableFrom, target.columnIndex, width)
				this.applyColumnWidths()

				const nextTarget = findResizeTarget(this.view, event)
				if (nextTarget?.tableFrom === target.tableFrom) {
					this.target = { ...target, edgeX: nextTarget.edgeX, width }
				} else {
					this.target = { ...target, width }
				}
				this.positionHandle()
			}

			private readonly handleDocumentPointerUp = (event: PointerEvent) => {
				if (!this.activeResize) return
				event.preventDefault()
				event.stopPropagation()
				this.activeResize = null
				this.layer.classList.remove("is-resizing")
				this.positionHandle()
			}

			private readonly handleDocumentKeyDown = (event: KeyboardEvent) => {
				if (event.key !== "Escape" || !this.activeResize) return
				event.preventDefault()
				event.stopPropagation()
				const { previousWidth, target } = this.activeResize
				if (previousWidth === null) {
					this.deleteColumnWidth(target.tableFrom, target.columnIndex)
				} else {
					this.setColumnWidth(target.tableFrom, target.columnIndex, previousWidth)
				}
				this.activeResize = null
				this.layer.classList.remove("is-resizing")
				this.applyColumnWidths()
				this.positionHandle()
				this.view.focus()
			}

			private remapTableWidths(update: EditorRuntimeViewUpdate): void {
				if (this.widthsByTable.size === 0) return
				const next = new Map<number, Map<number, number>>()
				for (const [tableFrom, widths] of this.widthsByTable) {
					const mappedFrom = update.changes.mapPos(tableFrom, 1)
					next.set(mappedFrom, widths)
				}
				this.widthsByTable.clear()
				for (const [tableFrom, widths] of next) this.widthsByTable.set(tableFrom, widths)
			}

			private setColumnWidth(tableFrom: number, columnIndex: number, width: number): void {
				let widths = this.widthsByTable.get(tableFrom)
				if (!widths) {
					widths = new Map()
					this.widthsByTable.set(tableFrom, widths)
				}
				widths.set(columnIndex, width)
			}

			private deleteColumnWidth(tableFrom: number, columnIndex: number): void {
				const widths = this.widthsByTable.get(tableFrom)
				if (!widths) return
				widths.delete(columnIndex)
				if (widths.size === 0) this.widthsByTable.delete(tableFrom)
			}

			private clearColumnWidths(): void {
				for (const cell of this.view.dom.querySelectorAll<HTMLElement>(".cm-table-cell-resized")) {
					cell.classList.remove("cm-table-cell-resized")
					cell.style.removeProperty("--cm-table-column-width")
				}
			}

			private applyColumnWidths(): void {
				this.clearColumnWidths()
				for (const wrapper of this.view.dom.querySelectorAll<HTMLElement>(".cm-table-wrapper")) {
					const tableFrom = getTableFrom(wrapper)
					if (tableFrom === null) continue
					const widths = this.widthsByTable.get(tableFrom)
					if (!widths) continue

					for (const cell of wrapper.querySelectorAll<HTMLElement>(
						".cm-table-cell:not(.cm-table-delimiter-cell)",
					)) {
						const columnIndex = getColumnIndex(cell)
						const width = columnIndex === null ? undefined : widths.get(columnIndex)
						if (width === undefined) continue
						cell.classList.add("cm-table-cell-resized")
						cell.style.setProperty("--cm-table-column-width", `${width}px`)
					}
				}
			}

			private hideHandle(): void {
				this.handle.hidden = true
				this.layer.classList.remove("is-active")
			}

			private positionHandle(): void {
				if (!this.target) {
					this.hideHandle()
					return
				}
				const editorRect = this.view.dom.getBoundingClientRect()
				const wrapperRect = this.target.wrapper.getBoundingClientRect()
				if (!hasMeasuredRect(editorRect) || !hasMeasuredRect(wrapperRect)) {
					this.hideHandle()
					return
				}

				this.handle.hidden = false
				this.layer.classList.add("is-active")
				setElementRect(
					this.handle,
					this.target.edgeX - editorRect.left - columnResizeHandleWidth / 2,
					wrapperRect.top - editorRect.top,
					columnResizeHandleWidth,
					wrapperRect.height,
				)
			}
		},
	)
}
