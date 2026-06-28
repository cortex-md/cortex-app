import type { EditorRuntimeView } from "./types"

export type TableRenderedRowKind = "header" | "body"

export interface TablePointerCoordinates {
	x: number
	y: number
}

export interface TableRenderedCellTarget {
	cell: HTMLElement
	row: HTMLElement
	wrapper: HTMLElement
	rowKind: TableRenderedRowKind
	rowIndex: number
	columnIndex: number
	cursor: number
	contentFrom: number
	contentTo: number
	from: number
	to: number
	sourceFrom: number
	sourceTo: number
	empty: boolean
}

export interface TablePointerCellTarget extends TableRenderedCellTarget {
	directCell: HTMLElement | null
	hitsText: boolean
	useCellCursor: boolean
}

export function parseDatasetInteger(element: HTMLElement, name: keyof DOMStringMap): number | null {
	const value = element.dataset[name]
	if (value === undefined) return null
	const numberValue = Number(value)
	return Number.isInteger(numberValue) ? numberValue : null
}

export function hasMeasuredRect(rect: DOMRect): boolean {
	return rect.width > 0 || rect.height > 0
}

export function isWithinRange(value: number, from: number, to: number): boolean {
	return value >= from && value <= to
}

export function getPointerCoordinates(event: MouseEvent): TablePointerCoordinates | null {
	const x = Number(event.clientX)
	const y = Number(event.clientY)
	return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

function isEditableTableCell(element: Element | null): element is HTMLElement {
	return (
		element instanceof HTMLElement &&
		element.dataset.tableCell === "true" &&
		!element.classList.contains("cm-table-delimiter-cell")
	)
}

export function findEditableTableCell(target: EventTarget | null): HTMLElement | null {
	if (target instanceof HTMLElement) {
		const cell = target.closest<HTMLElement>("[data-table-cell]")
		return isEditableTableCell(cell) ? cell : null
	}
	if (target instanceof Node && target.parentElement) {
		const cell = target.parentElement.closest<HTMLElement>("[data-table-cell]")
		return isEditableTableCell(cell) ? cell : null
	}
	return null
}

export function getEditableCellsInRow(row: HTMLElement): HTMLElement[] {
	return Array.from(row.querySelectorAll<HTMLElement>("[data-table-cell]")).filter(
		isEditableTableCell,
	)
}

export function getEditableRowsInWrapper(wrapper: HTMLElement): HTMLElement[] {
	return Array.from(wrapper.querySelectorAll<HTMLElement>("[data-table-row]")).filter(
		(row) => row.dataset.tableRowKind === "header" || row.dataset.tableRowKind === "body",
	)
}

export function findCellInRowFromX(row: HTMLElement, x: number): HTMLElement | null {
	const cells = getEditableCellsInRow(row)
	if (cells.length === 0) return null

	let nearestCell: HTMLElement | null = null
	let nearestDistance = Number.POSITIVE_INFINITY
	let hasMeasuredCell = false

	for (const cell of cells) {
		const rect = cell.getBoundingClientRect()
		if (!hasMeasuredRect(rect)) continue
		hasMeasuredCell = true
		if (isWithinRange(x, rect.left - 2, rect.right + 2)) return cell

		const center = rect.left + rect.width / 2
		const distance = Math.abs(x - center)
		if (distance < nearestDistance) {
			nearestCell = cell
			nearestDistance = distance
		}
	}

	return hasMeasuredCell ? nearestCell : cells[0]
}

export function findRowInWrapperFromY(wrapper: HTMLElement, y: number): HTMLElement | null {
	for (const row of getEditableRowsInWrapper(wrapper)) {
		const rect = row.getBoundingClientRect()
		if (!hasMeasuredRect(rect)) continue
		if (isWithinRange(y, rect.top - 2, rect.bottom + 2)) return row
	}
	return null
}

function findTableWrapper(target: EventTarget | null): HTMLElement | null {
	if (target instanceof HTMLElement) return target.closest<HTMLElement>(".cm-table-wrapper")
	if (target instanceof Node && target.parentElement) {
		return target.parentElement.closest<HTMLElement>(".cm-table-wrapper")
	}
	return null
}

function findTableRow(target: EventTarget | null): HTMLElement | null {
	if (target instanceof HTMLElement) return target.closest<HTMLElement>("[data-table-row]")
	if (target instanceof Node && target.parentElement) {
		return target.parentElement.closest<HTMLElement>("[data-table-row]")
	}
	return null
}

function findTableRowFromPoint(event: MouseEvent): HTMLElement | null {
	const ownerDocument =
		event.target instanceof Node ? event.target.ownerDocument : globalThis.document
	const elementsFromPoint = ownerDocument?.elementsFromPoint
	if (!elementsFromPoint) return null
	for (const element of elementsFromPoint.call(ownerDocument, event.clientX, event.clientY)) {
		if (element instanceof HTMLElement && element.matches("[data-table-row]")) return element
	}
	return null
}

function findRowInWrapperFromPointer(wrapper: HTMLElement, event: MouseEvent): HTMLElement | null {
	const point = getPointerCoordinates(event)
	if (!point) return null

	const pointRow = findTableRowFromPoint(event)
	if (pointRow?.closest(".cm-table-wrapper") === wrapper) {
		const kind = pointRow.dataset.tableRowKind
		if (kind === "header" || kind === "body") return pointRow
	}

	return findRowInWrapperFromY(wrapper, point.y)
}

function createTableCellTargetFromCell(cell: HTMLElement): TableRenderedCellTarget | null {
	const row = cell.closest<HTMLElement>("[data-table-row]")
	const wrapper = cell.closest<HTMLElement>(".cm-table-wrapper")
	if (!row || !wrapper) return null

	const rowKind = row.dataset.tableRowKind
	if (rowKind !== "header" && rowKind !== "body") return null

	const rowIndex = parseDatasetInteger(cell, "tableCellRowIndex")
	const columnIndex = parseDatasetInteger(cell, "tableCellColumnIndex")
	const cursor = parseDatasetInteger(cell, "tableCellCursor")
	const contentFrom = parseDatasetInteger(cell, "tableCellContentFrom")
	const contentTo = parseDatasetInteger(cell, "tableCellContentTo")
	const from = parseDatasetInteger(cell, "tableCellFrom")
	const to = parseDatasetInteger(cell, "tableCellTo")
	const sourceFrom = parseDatasetInteger(cell, "tableCellSourceFrom")
	const sourceTo = parseDatasetInteger(cell, "tableCellSourceTo")
	if (
		rowIndex === null ||
		columnIndex === null ||
		cursor === null ||
		contentFrom === null ||
		contentTo === null ||
		from === null ||
		to === null ||
		sourceFrom === null ||
		sourceTo === null
	) {
		return null
	}

	return {
		cell,
		row,
		wrapper,
		rowKind,
		rowIndex,
		columnIndex,
		cursor,
		contentFrom,
		contentTo,
		from,
		to,
		sourceFrom,
		sourceTo,
		empty: cell.dataset.tableCellEmpty === "true",
	}
}

function pointHitsMeasuredTextRect(cell: HTMLElement, event: MouseEvent): boolean {
	const point = getPointerCoordinates(event)
	if (!point) return false

	const ownerDocument = cell.ownerDocument
	const nodeFilter = ownerDocument.defaultView?.NodeFilter.SHOW_TEXT ?? 4
	const walker = ownerDocument.createTreeWalker(cell, nodeFilter)

	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (!node.textContent?.trim()) continue
		const range = ownerDocument.createRange()
		range.selectNodeContents(node)
		if (typeof range.getClientRects !== "function") {
			range.detach()
			continue
		}
		for (const rect of Array.from(range.getClientRects())) {
			if (!hasMeasuredRect(rect)) continue
			if (
				isWithinRange(point.x, rect.left - 1, rect.right + 1) &&
				isWithinRange(point.y, rect.top - 2, rect.bottom + 2)
			) {
				range.detach()
				return true
			}
		}
		range.detach()
	}

	return false
}

function pointHitsTableCellText(
	view: EditorRuntimeView,
	cell: HTMLElement,
	event: MouseEvent,
): boolean {
	const target = createTableCellTargetFromCell(cell)
	if (!target || target.empty || target.contentFrom === target.contentTo) return false
	if (pointHitsMeasuredTextRect(cell, event)) return true
	if (event.target instanceof Node && event.target !== cell && cell.contains(event.target)) {
		return true
	}

	let position: number | null = null
	try {
		position = view.posAtCoords({ x: event.clientX, y: event.clientY })
	} catch {
		position = null
	}
	return position !== null && position > target.contentFrom && position < target.contentTo
}

export function resolveTableCellFromPointer(
	view: EditorRuntimeView,
	event: MouseEvent,
): TablePointerCellTarget | null {
	const directCell = findEditableTableCell(event.target)
	const point = getPointerCoordinates(event)
	if (directCell) {
		const directTarget = createTableCellTargetFromCell(directCell)
		const directRect = directCell.getBoundingClientRect()
		if (
			directTarget &&
			(!point ||
				!hasMeasuredRect(directRect) ||
				(isWithinRange(point.x, directRect.left - 2, directRect.right + 2) &&
					isWithinRange(point.y, directRect.top - 2, directRect.bottom + 2)))
		) {
			return {
				...directTarget,
				directCell,
				hitsText: pointHitsTableCellText(view, directCell, event),
				useCellCursor: false,
			}
		}
	}

	const directRow = findTableRow(event.target)
	if (point && directRow && !directCell) {
		const kind = directRow.dataset.tableRowKind
		if (kind === "header" || kind === "body") {
			const cell = findCellInRowFromX(directRow, point.x)
			const target = cell ? createTableCellTargetFromCell(cell) : null
			if (target) {
				return {
					...target,
					directCell,
					hitsText: directCell === target.cell && pointHitsTableCellText(view, target.cell, event),
					useCellCursor: directCell !== cell,
				}
			}
		}
	}

	const directWrapper = directCell?.closest<HTMLElement>(".cm-table-wrapper") ?? null
	const eventWrapper = findTableWrapper(event.target)
	if (point && eventWrapper) {
		const row = findRowInWrapperFromPointer(eventWrapper, event)
		const cell = row ? findCellInRowFromX(row, point.x) : null
		const target = cell ? createTableCellTargetFromCell(cell) : null
		if (target) {
			return {
				...target,
				directCell,
				hitsText: directCell === target.cell && pointHitsTableCellText(view, target.cell, event),
				useCellCursor: directCell !== cell,
			}
		}
	}

	const wrappers = directWrapper
		? [directWrapper]
		: Array.from(view.dom.querySelectorAll<HTMLElement>(".cm-table-wrapper"))

	if (point) {
		for (const wrapper of wrappers) {
			const wrapperRect = wrapper.getBoundingClientRect()
			if (!hasMeasuredRect(wrapperRect)) continue
			if (!isWithinRange(point.x, wrapperRect.left - 2, wrapperRect.right + 2)) continue
			if (!isWithinRange(point.y, wrapperRect.top - 2, wrapperRect.bottom + 2)) continue

			const row = findRowInWrapperFromPointer(wrapper, event)
			const cell = row ? findCellInRowFromX(row, point.x) : null
			const target = cell ? createTableCellTargetFromCell(cell) : null
			if (!target) continue
			return {
				...target,
				directCell,
				hitsText: directCell === target.cell && pointHitsTableCellText(view, target.cell, event),
				useCellCursor: directCell !== cell,
			}
		}
	}

	if (!directCell) return null
	const target = createTableCellTargetFromCell(directCell)
	if (!target) return null
	return {
		...target,
		directCell,
		hitsText: pointHitsTableCellText(view, directCell, event),
		useCellCursor: false,
	}
}
