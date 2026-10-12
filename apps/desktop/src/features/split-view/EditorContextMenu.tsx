import { executeCommand } from "@cortex/commands"
import { useEditorStore } from "@cortex/core"
import { getCalloutTypes } from "@cortex/editor/callouts"
import { hasTableCellSelection, isSelectionInsideTable } from "@cortex/editor/commands"
import type { EditorRuntimeView } from "@cortex/editor/types"
import { setEditorViewRef } from "@cortex/plugin-host-core"
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react"
import {
	commandMenuItem,
	compactMenuItems,
	getPluginMenuItems,
	MENU_SEPARATOR,
	type MenuItem,
} from "@/utils/context-menu"
import { useContextMenu } from "../context-menu/useContextMenu"

interface EditorContextMenuProps {
	getEditorView: () => EditorRuntimeView | null
	children: ReactNode
}

function runCommand(view: EditorRuntimeView | null, commandId: string, payload?: unknown) {
	if (!view) return
	setEditorViewRef(view as never)
	executeCommand(commandId, { source: "menu", payload })
	view.focus()
}

function parseDatasetInteger(element: HTMLElement, name: keyof DOMStringMap): number | null {
	const value = element.dataset[name]
	if (value === undefined) return null
	const numberValue = Number(value)
	return Number.isInteger(numberValue) ? numberValue : null
}

function findContextMenuTableCell(
	view: EditorRuntimeView,
	event: Pick<ReactMouseEvent, "target" | "clientX" | "clientY">,
): HTMLElement | null {
	if (event.target instanceof HTMLElement) {
		const cell = event.target.closest<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)")
		if (cell && view.dom.contains(cell)) return cell
	}
	const ownerDocument = view.dom.ownerDocument
	const elementsFromPoint = ownerDocument.elementsFromPoint?.(event.clientX, event.clientY) ?? []
	for (const element of elementsFromPoint) {
		if (!(element instanceof HTMLElement)) continue
		const cell = element.closest<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)")
		if (cell && view.dom.contains(cell)) return cell
	}
	return null
}

function getContextMenuTableCursor(
	view: EditorRuntimeView,
	event: Pick<ReactMouseEvent, "target" | "clientX" | "clientY">,
): number | null {
	const cell = findContextMenuTableCell(view, event)
	return cell ? parseDatasetInteger(cell, "tableCellCursor") : null
}

interface EditorMenuTarget {
	view: EditorRuntimeView
	tableCursor: number | null
	filePath: string | null
}

interface EditorItemOptions {
	id?: string
	payload?: unknown
	targetTableCell?: boolean
}

function editorItem(
	{ view, tableCursor }: EditorMenuTarget,
	commandId: string,
	text: string,
	{ id = commandId, payload, targetTableCell = false }: EditorItemOptions = {},
): MenuItem | null {
	return commandMenuItem(commandId, {
		id,
		text,
		action: () => {
			if (targetTableCell && tableCursor !== null) {
				view.dispatch({ selection: { anchor: tableCursor } })
			}
			runCommand(view, commandId, payload)
		},
	})
}

function buildTableMenuItems(target: EditorMenuTarget): MenuItem[] {
	const item = (commandId: string, text: string) =>
		editorItem(target, commandId, text, { targetTableCell: true })
	const hasCellSelection = hasTableCellSelection(target.view)
	return [
		MENU_SEPARATOR,
		{ type: "label", id: "table-label", text: "Table" },
		...(hasCellSelection
			? [
					editorItem(target, "table.copy-selection-tsv", "Copy Selection as TSV"),
					editorItem(target, "table.clear-selection", "Clear Selection"),
					MENU_SEPARATOR,
				]
			: []),
		{
			type: "submenu",
			id: "table-align-column",
			text: "Align Column",
			items: compactMenuItems([
				item("table.align-left", "Left"),
				item("table.align-center", "Center"),
				item("table.align-right", "Right"),
			]),
		},
		MENU_SEPARATOR,
		item("table.add-row-above", "Add Row Above"),
		item("table.add-row-below", "Add Row Below"),
		item("table.add-row-end", "Add Row at End"),
		item("table.add-column-left", "Add Column Left"),
		item("table.add-column-right", "Add Column Right"),
		item("table.add-column-end", "Add Column at End"),
		MENU_SEPARATOR,
		item("table.duplicate-row", "Duplicate Row"),
		item("table.duplicate-column", "Duplicate Column"),
		MENU_SEPARATOR,
		item("table.move-row-up", "Move Row Up"),
		item("table.move-row-down", "Move Row Down"),
		item("table.move-column-left", "Move Column Left"),
		item("table.move-column-right", "Move Column Right"),
		MENU_SEPARATOR,
		{
			type: "submenu",
			id: "table-copy",
			text: "Copy",
			items: compactMenuItems([
				item("table.copy-markdown", "Table as Markdown"),
				item("table.copy-tsv", "Table as TSV"),
				item("table.copy-row-tsv", "Row as TSV"),
				item("table.copy-column-tsv", "Column as TSV"),
			]),
		},
		MENU_SEPARATOR,
		item("table.clear-cell", "Clear Cell"),
		item("table.delete-row", "Delete Row"),
		item("table.delete-column", "Delete Column"),
		{ ...item("table.delete", "Delete Table"), destructive: true } as MenuItem,
	].filter((entry): entry is MenuItem => entry !== null)
}

function buildEditorMenuItems(target: EditorMenuTarget): MenuItem[] {
	const item = (commandId: string, text: string, options?: EditorItemOptions) =>
		editorItem(target, commandId, text, options)
	const { view, tableCursor, filePath } = target
	const selection = view.state.selection.main
	const isInTable = tableCursor !== null || isSelectionInsideTable(view)

	return compactMenuItems([
		{
			type: "submenu",
			id: "turn-into",
			text: "Turn into",
			items: compactMenuItems([
				item("editor.turn-into-text", "Text"),
				MENU_SEPARATOR,
				item("format.heading-1", "Heading 1"),
				item("format.heading-2", "Heading 2"),
				item("format.heading-3", "Heading 3"),
				MENU_SEPARATOR,
				item("format.blockquote", "Blockquote"),
				item("format.code-block", "Code Block"),
				MENU_SEPARATOR,
				item("format.task-list", "Task List"),
				item("format.unordered-list", "Unordered List"),
				item("format.ordered-list", "Ordered List"),
			]),
		},
		...(selection.empty
			? []
			: [
					MENU_SEPARATOR,
					{ type: "label" as const, id: "format-label", text: "Format" },
					item("format.bold", "Bold"),
					item("format.italic", "Italic"),
					item("format.strikethrough", "Strikethrough"),
					item("format.inline-code", "Inline Code"),
					item("format.link", "Link"),
				]),
		...(isInTable ? buildTableMenuItems(target) : []),
		MENU_SEPARATOR,
		{ type: "label", id: "insert-label", text: "Insert" },
		item("format.link", "Link", { id: "insert-link" }),
		item("format.image", "Image"),
		item("format.inline-math", "Inline Formula"),
		item("format.math-block", "Formula Block"),
		item("format.table", "Table", { id: "insert-table" }),
		item("format.drawing", "Drawing"),
		{
			type: "submenu",
			id: "insert-callout",
			text: "Callout",
			items: compactMenuItems(
				getCalloutTypes().map((callout) =>
					item("format.callout", callout.label, {
						id: `insert-callout-${callout.type}`,
						payload: { calloutType: callout.type },
					}),
				),
			),
		},
		MENU_SEPARATOR,
		item("editor.copy-line", "Copy Line"),
		item("editor.duplicate-line", "Duplicate Line"),
		...getPluginMenuItems({
			location: "editor",
			filePath,
			selection: { from: selection.from, to: selection.to },
		}),
	])
}

export function EditorContextMenu({ getEditorView, children }: EditorContextMenuProps) {
	const { showMenu, menu } = useContextMenu()

	const handleContextMenu = (event: ReactMouseEvent) => {
		const view = getEditorView()
		if (!view) return
		event.preventDefault()
		const items = buildEditorMenuItems({
			view,
			tableCursor: getContextMenuTableCursor(view, event),
			filePath: useEditorStore.getState().activeFilePath,
		})
		showMenu(items, { x: event.clientX, y: event.clientY })
	}

	return (
		<>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: editor wrapper intercepts the context menu */}
			<div onContextMenu={handleContextMenu}>{children}</div>
			{menu}
		</>
	)
}
