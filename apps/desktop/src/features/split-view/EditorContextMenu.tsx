import { executeCommand } from "@cortex/commands"
import { useEditorStore } from "@cortex/core"
import {
	getCalloutRegistryVersion,
	getCalloutTypes,
	subscribeCalloutTypes,
} from "@cortex/editor/callouts"
import { hasTableCellSelection, isSelectionInsideTable } from "@cortex/editor/commands"
import type { EditorRuntimeView } from "@cortex/editor/types"
import { getPlatform } from "@cortex/platform"
import { setEditorViewRef } from "@cortex/plugin-host-core"
import { usePluginStore } from "@cortex/plugin-host-web"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
	LucideIcon,
} from "@cortex/ui"
import type { ContextMenuActionContext, ContextMenuItemRegistration } from "@cortex.md/api"
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react"
import { useCallback, useMemo, useState, useSyncExternalStore } from "react"
import type { MenuItem } from "@/utils/context-menu"
import { NativeMenuActions } from "@/utils/context-menu"

interface EditorContextMenuProps {
	getEditorView: () => EditorRuntimeView | null
	children: ReactNode
}

interface RegisteredContextMenuItem extends ContextMenuItemRegistration {
	registrationKey?: string
}

function runCommand(view: EditorRuntimeView | null, commandId: string, payload?: unknown) {
	if (!view) return
	setEditorViewRef(view as never)
	executeCommand(commandId, { source: "menu", payload })
	view.focus()
}

function runTableCommand(
	view: EditorRuntimeView | null,
	tableCursor: number | null,
	commandId: string,
) {
	if (!view) return
	if (tableCursor !== null) view.dispatch({ selection: { anchor: tableCursor } })
	runCommand(view, commandId)
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

function buildNativeTableItems(view: EditorRuntimeView, tableCursor: number | null): MenuItem[] {
	const hasCellSelection = hasTableCellSelection(view)
	return [
		...(hasCellSelection
			? [
					{
						id: "table-copy-selection-tsv",
						text: "Copy Selection as TSV",
						action: () => runCommand(view, "table.copy-selection-tsv"),
					},
					{
						id: "table-clear-selection",
						text: "Clear Selection",
						action: () => runCommand(view, "table.clear-selection"),
					},
					{ type: "separator" as const },
				]
			: []),
		{
			id: "table-align-column",
			type: "submenu",
			text: "Align Column",
			items: [
				{
					id: "table-align-left",
					text: "Left",
					action: () => runTableCommand(view, tableCursor, "table.align-left"),
				},
				{
					id: "table-align-center",
					text: "Center",
					action: () => runTableCommand(view, tableCursor, "table.align-center"),
				},
				{
					id: "table-align-right",
					text: "Right",
					action: () => runTableCommand(view, tableCursor, "table.align-right"),
				},
			],
		},
		{ type: "separator" },
		{
			id: "table-add-row-above",
			text: "Add Row Above",
			action: () => runTableCommand(view, tableCursor, "table.add-row-above"),
		},
		{
			id: "table-add-row-below",
			text: "Add Row Below",
			accelerator: "CmdOrCtrl+Enter",
			action: () => runTableCommand(view, tableCursor, "table.add-row-below"),
		},
		{
			id: "table-add-row-end",
			text: "Add Row at End",
			action: () => runTableCommand(view, tableCursor, "table.add-row-end"),
		},
		{
			id: "table-add-column-left",
			text: "Add Column Left",
			action: () => runTableCommand(view, tableCursor, "table.add-column-left"),
		},
		{
			id: "table-add-column-right",
			text: "Add Column Right",
			action: () => runTableCommand(view, tableCursor, "table.add-column-right"),
		},
		{
			id: "table-add-column-end",
			text: "Add Column at End",
			action: () => runTableCommand(view, tableCursor, "table.add-column-end"),
		},
		{ type: "separator" },
		{
			id: "table-duplicate-row",
			text: "Duplicate Row",
			action: () => runTableCommand(view, tableCursor, "table.duplicate-row"),
		},
		{
			id: "table-duplicate-column",
			text: "Duplicate Column",
			action: () => runTableCommand(view, tableCursor, "table.duplicate-column"),
		},
		{ type: "separator" },
		{
			id: "table-move-row-up",
			text: "Move Row Up",
			action: () => runTableCommand(view, tableCursor, "table.move-row-up"),
		},
		{
			id: "table-move-row-down",
			text: "Move Row Down",
			action: () => runTableCommand(view, tableCursor, "table.move-row-down"),
		},
		{
			id: "table-move-column-left",
			text: "Move Column Left",
			action: () => runTableCommand(view, tableCursor, "table.move-column-left"),
		},
		{
			id: "table-move-column-right",
			text: "Move Column Right",
			action: () => runTableCommand(view, tableCursor, "table.move-column-right"),
		},
		{ type: "separator" },
		{
			id: "table-copy",
			type: "submenu",
			text: "Copy",
			items: [
				{
					id: "table-copy-markdown",
					text: "Table as Markdown",
					action: () => runTableCommand(view, tableCursor, "table.copy-markdown"),
				},
				{
					id: "table-copy-tsv",
					text: "Table as TSV",
					action: () => runTableCommand(view, tableCursor, "table.copy-tsv"),
				},
				{
					id: "table-copy-row-tsv",
					text: "Row as TSV",
					action: () => runTableCommand(view, tableCursor, "table.copy-row-tsv"),
				},
				{
					id: "table-copy-column-tsv",
					text: "Column as TSV",
					action: () => runTableCommand(view, tableCursor, "table.copy-column-tsv"),
				},
			],
		},
		{ type: "separator" },
		{
			id: "table-clear-cell",
			text: "Clear Cell",
			action: () => runTableCommand(view, tableCursor, "table.clear-cell"),
		},
		{
			id: "table-delete-row",
			text: "Delete Row",
			action: () => runTableCommand(view, tableCursor, "table.delete-row"),
		},
		{
			id: "table-delete-column",
			text: "Delete Column",
			action: () => runTableCommand(view, tableCursor, "table.delete-column"),
		},
		{
			id: "table-delete",
			text: "Delete Table",
			action: () => runTableCommand(view, tableCursor, "table.delete"),
		},
	]
}

function buildNativeMenuItems(
	view: EditorRuntimeView,
	hasSelection: boolean,
	tableCursor: number | null,
	pluginItems: RegisteredContextMenuItem[],
	pluginContext: ContextMenuActionContext,
): MenuItem[] {
	const items: MenuItem[] = [
		{
			id: "turn-into",
			type: "submenu",
			text: "Turn into",
			items: [
				{
					id: "turn-text",
					text: "Text",
					action: () => runCommand(view, "editor.turn-into-text"),
				},
				{ type: "separator" },
				{
					id: "turn-h1",
					text: "Heading 1",
					accelerator: "CmdOrCtrl+Alt+1",
					action: () => runCommand(view, "format.heading-1"),
				},
				{
					id: "turn-h2",
					text: "Heading 2",
					accelerator: "CmdOrCtrl+Alt+2",
					action: () => runCommand(view, "format.heading-2"),
				},
				{
					id: "turn-h3",
					text: "Heading 3",
					accelerator: "CmdOrCtrl+Alt+3",
					action: () => runCommand(view, "format.heading-3"),
				},
				{ type: "separator" },
				{
					id: "turn-blockquote",
					text: "Blockquote",
					accelerator: "CmdOrCtrl+Shift+.",
					action: () => runCommand(view, "format.blockquote"),
				},
				{
					id: "turn-code-block",
					text: "Code Block",
					action: () => runCommand(view, "format.code-block"),
				},
				{ type: "separator" },
				{
					id: "turn-task-list",
					text: "Task List",
					accelerator: "CmdOrCtrl+L",
					action: () => runCommand(view, "format.task-list"),
				},
				{
					id: "turn-unordered-list",
					text: "Unordered List",
					accelerator: "CmdOrCtrl+Shift+L",
					action: () => runCommand(view, "format.unordered-list"),
				},
				{
					id: "turn-ordered-list",
					text: "Ordered List",
					accelerator: "CmdOrCtrl+Shift+O",
					action: () => runCommand(view, "format.ordered-list"),
				},
			],
		},
	]

	if (hasSelection) {
		items.push(
			{ type: "separator" },
			{
				id: "format-bold",
				text: "Bold",
				accelerator: "CmdOrCtrl+B",
				action: () => runCommand(view, "format.bold"),
			},
			{
				id: "format-italic",
				text: "Italic",
				accelerator: "CmdOrCtrl+I",
				action: () => runCommand(view, "format.italic"),
			},
			{
				id: "format-strikethrough",
				text: "Strikethrough",
				accelerator: "CmdOrCtrl+Shift+X",
				action: () => runCommand(view, "format.strikethrough"),
			},
			{
				id: "format-inline-code",
				text: "Inline Code",
				action: () => runCommand(view, "format.inline-code"),
			},
			{
				id: "format-link",
				text: "Link",
				accelerator: "CmdOrCtrl+K",
				action: () => runCommand(view, "format.link"),
			},
		)
	}

	if (tableCursor !== null || isSelectionInsideTable(view)) {
		items.push(
			{ type: "separator" },
			{
				id: "table-actions",
				type: "submenu",
				text: "Table",
				items: buildNativeTableItems(view, tableCursor),
			},
		)
	}

	items.push(
		{ type: "separator" },
		{
			id: "insert-link",
			text: "Insert Link",
			accelerator: "CmdOrCtrl+K",
			action: () => runCommand(view, "format.link"),
		},
		{
			id: "insert-image",
			text: "Insert Image",
			accelerator: "CmdOrCtrl+Shift+K",
			action: () => runCommand(view, "format.image"),
		},
		{
			id: "insert-table",
			text: "Insert Table",
			accelerator: "CmdOrCtrl+Shift+Y",
			action: () => runCommand(view, "format.table"),
		},
		{
			id: "insert-callout",
			type: "submenu",
			text: "Insert Callout",
			items: getCalloutTypes().map((callout) => ({
				id: `insert-callout-${callout.type}`,
				text: callout.label,
				action: () => runCommand(view, "format.callout", { calloutType: callout.type }),
			})),
		},
		{ type: "separator" },
		{
			id: "copy-line",
			text: "Copy Line",
			action: () => runCommand(view, "editor.copy-line"),
		},
		{
			id: "duplicate-line",
			text: "Duplicate Line",
			action: () => runCommand(view, "editor.duplicate-line"),
		},
	)

	if (pluginItems.length > 0) {
		items.push(
			{ type: "separator" },
			...pluginItems.map((item) => ({
				id: `plugin-${item.registrationKey ?? item.id}`,
				text: item.label,
				action: () => item.action(pluginContext),
			})),
		)
	}

	return items
}

function getEditorPluginContext(
	view: EditorRuntimeView | null,
	filePath: string | null,
): ContextMenuActionContext {
	const selection = view?.state.selection.main
	return {
		location: "editor",
		filePath,
		selection: selection ? { from: selection.from, to: selection.to } : undefined,
	}
}

function PluginEditorContextMenuItems({
	items,
	context,
}: {
	items: RegisteredContextMenuItem[]
	context: ContextMenuActionContext
}) {
	if (items.length === 0) return null
	return (
		<>
			<ContextMenuSeparator />
			{items.map((item) => (
				<ContextMenuItem
					key={item.registrationKey ?? item.id}
					onSelect={() => void item.action(context)}
				>
					{item.icon && <LucideIcon name={item.icon} size={14} />}
					{item.label}
				</ContextMenuItem>
			))}
		</>
	)
}

function useEditorPluginContextMenuItems(): RegisteredContextMenuItem[] {
	const pluginContextMenuItems = usePluginStore((state) => state.contextMenuItems)
	return useMemo(
		() => pluginContextMenuItems.filter((item) => item.location === "editor"),
		[pluginContextMenuItems],
	)
}

interface EditorContextMenuContentProps {
	view: EditorRuntimeView | null
	hasSelection: boolean
	tableCursor: number | null
	isInTable: boolean
	hasCellSelection: boolean
	editorPluginItems: RegisteredContextMenuItem[]
	pluginContext: ContextMenuActionContext
}

interface EditorContextMenuSectionProps {
	view: EditorRuntimeView | null
}

interface TableContextMenuItemsProps extends EditorContextMenuSectionProps {
	tableCursor: number | null
	hasCellSelection: boolean
}

function TurnIntoContextMenu({ view }: EditorContextMenuSectionProps) {
	return (
		<ContextMenuSub>
			<ContextMenuSubTrigger>Turn into</ContextMenuSubTrigger>
			<ContextMenuSubContent>
				<ContextMenuItem onSelect={() => runCommand(view, "editor.turn-into-text")}>
					Text
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onSelect={() => runCommand(view, "format.heading-1")}>
					Heading 1<ContextMenuShortcut>⌘⌥1</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => runCommand(view, "format.heading-2")}>
					Heading 2<ContextMenuShortcut>⌘⌥2</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => runCommand(view, "format.heading-3")}>
					Heading 3<ContextMenuShortcut>⌘⌥3</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onSelect={() => runCommand(view, "format.blockquote")}>
					Blockquote<ContextMenuShortcut>⌘⇧.</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => runCommand(view, "format.code-block")}>
					Code Block
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onSelect={() => runCommand(view, "format.task-list")}>
					Task List<ContextMenuShortcut>⌘L</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => runCommand(view, "format.unordered-list")}>
					Unordered List<ContextMenuShortcut>⌘⇧L</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => runCommand(view, "format.ordered-list")}>
					Ordered List<ContextMenuShortcut>⌘⇧O</ContextMenuShortcut>
				</ContextMenuItem>
			</ContextMenuSubContent>
		</ContextMenuSub>
	)
}

function FormatContextMenuItems({ view }: EditorContextMenuSectionProps) {
	return (
		<>
			<ContextMenuSeparator />
			<ContextMenuLabel>Format</ContextMenuLabel>
			<ContextMenuItem onSelect={() => runCommand(view, "format.bold")}>
				Bold<ContextMenuShortcut>⌘B</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runCommand(view, "format.italic")}>
				Italic<ContextMenuShortcut>⌘I</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runCommand(view, "format.strikethrough")}>
				Strikethrough<ContextMenuShortcut>⌘⇧X</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runCommand(view, "format.inline-code")}>
				Inline Code<ContextMenuShortcut>⌘`</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runCommand(view, "format.link")}>
				Link<ContextMenuShortcut>⌘K</ContextMenuShortcut>
			</ContextMenuItem>
		</>
	)
}

function TableContextMenuItems({
	view,
	tableCursor,
	hasCellSelection,
}: TableContextMenuItemsProps) {
	return (
		<>
			<ContextMenuSeparator />
			<ContextMenuLabel>Table</ContextMenuLabel>
			{hasCellSelection && (
				<>
					<ContextMenuItem onSelect={() => runCommand(view, "table.copy-selection-tsv")}>
						Copy Selection as TSV
					</ContextMenuItem>
					<ContextMenuItem
						onSelect={() => runCommand(view, "table.clear-selection")}
						variant="destructive"
					>
						Clear Selection
					</ContextMenuItem>
					<ContextMenuSeparator />
				</>
			)}
			<ContextMenuSub>
				<ContextMenuSubTrigger>Align Column</ContextMenuSubTrigger>
				<ContextMenuSubContent>
					<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.align-left")}>
						Left
					</ContextMenuItem>
					<ContextMenuItem
						onSelect={() => runTableCommand(view, tableCursor, "table.align-center")}
					>
						Center
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.align-right")}>
						Right
					</ContextMenuItem>
				</ContextMenuSubContent>
			</ContextMenuSub>
			<ContextMenuSeparator />
			<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.add-row-above")}>
				Add Row Above
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.add-row-below")}>
				Add Row Below<ContextMenuShortcut>⌘↵</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.add-row-end")}>
				Add Row at End
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.add-column-left")}>
				Add Column Left
			</ContextMenuItem>
			<ContextMenuItem
				onSelect={() => runTableCommand(view, tableCursor, "table.add-column-right")}
			>
				Add Column Right
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.add-column-end")}>
				Add Column at End
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.duplicate-row")}>
				Duplicate Row
			</ContextMenuItem>
			<ContextMenuItem
				onSelect={() => runTableCommand(view, tableCursor, "table.duplicate-column")}
			>
				Duplicate Column
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.move-row-up")}>
				Move Row Up
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.move-row-down")}>
				Move Row Down
			</ContextMenuItem>
			<ContextMenuItem
				onSelect={() => runTableCommand(view, tableCursor, "table.move-column-left")}
			>
				Move Column Left
			</ContextMenuItem>
			<ContextMenuItem
				onSelect={() => runTableCommand(view, tableCursor, "table.move-column-right")}
			>
				Move Column Right
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuSub>
				<ContextMenuSubTrigger>Copy</ContextMenuSubTrigger>
				<ContextMenuSubContent>
					<ContextMenuItem
						onSelect={() => runTableCommand(view, tableCursor, "table.copy-markdown")}
					>
						Table as Markdown
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.copy-tsv")}>
						Table as TSV
					</ContextMenuItem>
					<ContextMenuItem
						onSelect={() => runTableCommand(view, tableCursor, "table.copy-row-tsv")}
					>
						Row as TSV
					</ContextMenuItem>
					<ContextMenuItem
						onSelect={() => runTableCommand(view, tableCursor, "table.copy-column-tsv")}
					>
						Column as TSV
					</ContextMenuItem>
				</ContextMenuSubContent>
			</ContextMenuSub>
			<ContextMenuSeparator />
			<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.clear-cell")}>
				Clear Cell
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.delete-row")}>
				Delete Row
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runTableCommand(view, tableCursor, "table.delete-column")}>
				Delete Column
			</ContextMenuItem>
			<ContextMenuItem
				onSelect={() => runTableCommand(view, tableCursor, "table.delete")}
				variant="destructive"
			>
				Delete Table
			</ContextMenuItem>
		</>
	)
}

function InsertContextMenuItems({ view }: EditorContextMenuSectionProps) {
	return (
		<>
			<ContextMenuSeparator />
			<ContextMenuLabel>Insert</ContextMenuLabel>
			<ContextMenuItem onSelect={() => runCommand(view, "format.link")}>
				Link<ContextMenuShortcut>⌘K</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runCommand(view, "format.image")}>
				Image<ContextMenuShortcut>⌘⇧K</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runCommand(view, "format.table")}>
				Table<ContextMenuShortcut>⌘⇧Y</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuSub>
				<ContextMenuSubTrigger>Callout</ContextMenuSubTrigger>
				<ContextMenuSubContent>
					{getCalloutTypes().map((callout) => (
						<ContextMenuItem
							key={callout.type}
							onSelect={() => runCommand(view, "format.callout", { calloutType: callout.type })}
						>
							{callout.label}
						</ContextMenuItem>
					))}
				</ContextMenuSubContent>
			</ContextMenuSub>
		</>
	)
}

function LineContextMenuItems({ view }: EditorContextMenuSectionProps) {
	return (
		<>
			<ContextMenuSeparator />
			<ContextMenuItem onSelect={() => runCommand(view, "editor.copy-line")}>
				Copy Line
			</ContextMenuItem>
			<ContextMenuItem onSelect={() => runCommand(view, "editor.duplicate-line")}>
				Duplicate Line
			</ContextMenuItem>
		</>
	)
}

function EditorContextMenuContent({
	view,
	hasSelection,
	tableCursor,
	isInTable,
	hasCellSelection,
	editorPluginItems,
	pluginContext,
}: EditorContextMenuContentProps) {
	return (
		<ContextMenuContent className="w-56">
			<TurnIntoContextMenu view={view} />
			{hasSelection && <FormatContextMenuItems view={view} />}
			{isInTable && (
				<TableContextMenuItems
					view={view}
					tableCursor={tableCursor}
					hasCellSelection={hasCellSelection}
				/>
			)}
			<InsertContextMenuItems view={view} />
			<LineContextMenuItems view={view} />
			<PluginEditorContextMenuItems items={editorPluginItems} context={pluginContext} />
		</ContextMenuContent>
	)
}

export function EditorContextMenu({ getEditorView, children }: EditorContextMenuProps) {
	const [capturedView, setCapturedView] = useState<EditorRuntimeView | null>(null)
	const [capturedTableCursor, setCapturedTableCursor] = useState<number | null>(null)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	useSyncExternalStore(subscribeCalloutTypes, getCalloutRegistryVersion, getCalloutRegistryVersion)
	const isNativePlatform = useMemo(() => getPlatform().capabilities.includes("menu"), [])
	const nativeMenu = useMemo(() => new NativeMenuActions(), [])
	const editorPluginItems = useEditorPluginContextMenuItems()

	const handleNativeContextMenu = useCallback(
		(event: ReactMouseEvent) => {
			event.preventDefault()
			const view = getEditorView()
			if (!view) return

			const hasSelection = !view.state.selection.main.empty
			const tableCursor = getContextMenuTableCursor(view, event)
			const items = buildNativeMenuItems(
				view,
				hasSelection,
				tableCursor,
				editorPluginItems,
				getEditorPluginContext(view, activeFilePath),
			)

			nativeMenu.showContextMenu({
				items,
				position: { x: event.clientX, y: event.clientY },
			})
		},
		[activeFilePath, editorPluginItems, getEditorView, nativeMenu],
	)

	const handleRadixContextMenu = useCallback(
		(event: ReactMouseEvent) => {
			const view = getEditorView()
			setCapturedView(view)
			setCapturedTableCursor(view ? getContextMenuTableCursor(view, event) : null)
		},
		[getEditorView],
	)

	const handleRadixContextMenuOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				setCapturedView(null)
				setCapturedTableCursor(null)
				return
			}
			setCapturedView((currentView) => currentView ?? getEditorView())
		},
		[getEditorView],
	)

	const view = capturedView
	const hasSelection = view ? !view.state.selection.main.empty : false
	const tableCursor = capturedTableCursor
	const isInTable = view ? tableCursor !== null || isSelectionInsideTable(view) : false
	const hasCellSelection = view ? hasTableCellSelection(view) : false
	const pluginContext = getEditorPluginContext(view, activeFilePath)

	if (isNativePlatform) {
		return (
			// biome-ignore lint/a11y/noStaticElementInteractions: editor wrapper intercepts context menu for native menu
			<div onContextMenu={handleNativeContextMenu}>{children}</div>
		)
	}

	return (
		<ContextMenu onOpenChange={handleRadixContextMenuOpenChange}>
			<ContextMenuTrigger asChild>
				<div onContextMenuCapture={handleRadixContextMenu}>{children}</div>
			</ContextMenuTrigger>
			<EditorContextMenuContent
				view={view}
				hasSelection={hasSelection}
				tableCursor={tableCursor}
				isInTable={isInTable}
				hasCellSelection={hasCellSelection}
				editorPluginItems={editorPluginItems}
				pluginContext={pluginContext}
			/>
		</ContextMenu>
	)
}
