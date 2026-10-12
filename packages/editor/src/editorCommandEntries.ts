import type { CommandEntry } from "@cortex/commands"
import {
	foldAllRanges,
	toggleFoldAtSelection,
	unfoldAllRanges,
	unfoldCurrentFold,
} from "./foldingCommands"
import {
	addTableColumnEnd,
	addTableColumnLeft,
	addTableColumnRight,
	addTableRowAbove,
	addTableRowBelow,
	addTableRowEnd,
	alignTableColumnCenter,
	alignTableColumnLeft,
	alignTableColumnRight,
	clearTableCell,
	clearTableSelection,
	copyLine,
	copyTableColumnTsv,
	copyTableMarkdown,
	copyTableRowTsv,
	copyTableSelectionTsv,
	copyTableTsv,
	deleteTable,
	deleteTableColumn,
	deleteTableRow,
	duplicateLine,
	duplicateTableColumn,
	duplicateTableRow,
	moveTableColumnLeft,
	moveTableColumnRight,
	moveTableRowDown,
	moveTableRowUp,
} from "./markdownCommands"
import { openFindPanel } from "./searchCommands"
import type { EditorCommand } from "./types"

type EditorCommandRow = readonly [
	id: string,
	label: string,
	command: EditorCommand,
	aliases: readonly string[],
	hotkey?: string,
]

const editorCommandRows: readonly EditorCommandRow[] = [
	["editor.find", "Find in File", openFindPanel, ["find"], "mod+f"],
	[
		"editor.toggle-fold",
		"Toggle Fold",
		toggleFoldAtSelection,
		["fold", "toggle-fold"],
		"mod+alt+[",
	],
	[
		"editor.unfold-current",
		"Unfold Current Fold",
		unfoldCurrentFold,
		["unfold", "unfold-current"],
		"mod+alt+]",
	],
	["editor.fold-all", "Fold All", foldAllRanges, ["fold-all"]],
	["editor.unfold-all", "Unfold All", unfoldAllRanges, ["unfold-all"]],
	["editor.copy-line", "Copy Line", copyLine, ["copy-line"]],
	["editor.duplicate-line", "Duplicate Line", duplicateLine, ["duplicate-line"]],
]

const tableCommandRows: readonly EditorCommandRow[] = [
	["add-row-above", "Add Row Above", addTableRowAbove, ["add-row-above", "table-row-above"]],
	[
		"add-row-below",
		"Add Row Below",
		addTableRowBelow,
		["add-row-below", "table-row-below"],
		"mod+enter",
	],
	["add-row-end", "Add Row at End", addTableRowEnd, ["add-row-end", "table-row-end"]],
	[
		"add-column-left",
		"Add Column Left",
		addTableColumnLeft,
		["add-column-left", "table-column-left"],
	],
	[
		"add-column-right",
		"Add Column Right",
		addTableColumnRight,
		["add-column-right", "table-column-right"],
	],
	[
		"add-column-end",
		"Add Column at End",
		addTableColumnEnd,
		["add-column-end", "table-column-end"],
	],
	[
		"align-left",
		"Align Column Left",
		alignTableColumnLeft,
		["align-column-left", "table-align-left"],
	],
	[
		"align-center",
		"Align Column Center",
		alignTableColumnCenter,
		["align-column-center", "table-align-center"],
	],
	[
		"align-right",
		"Align Column Right",
		alignTableColumnRight,
		["align-column-right", "table-align-right"],
	],
	["duplicate-row", "Duplicate Row", duplicateTableRow, ["duplicate-row", "table-duplicate-row"]],
	[
		"duplicate-column",
		"Duplicate Column",
		duplicateTableColumn,
		["duplicate-column", "table-duplicate-column"],
	],
	["move-row-up", "Move Row Up", moveTableRowUp, ["move-row-up", "table-move-row-up"]],
	["move-row-down", "Move Row Down", moveTableRowDown, ["move-row-down", "table-move-row-down"]],
	[
		"move-column-left",
		"Move Column Left",
		moveTableColumnLeft,
		["move-column-left", "table-move-column-left"],
	],
	[
		"move-column-right",
		"Move Column Right",
		moveTableColumnRight,
		["move-column-right", "table-move-column-right"],
	],
	[
		"copy-markdown",
		"Copy Table as Markdown",
		copyTableMarkdown,
		["copy-table-markdown", "table-copy-markdown"],
	],
	["copy-tsv", "Copy Table as TSV", copyTableTsv, ["copy-table-tsv", "table-copy-tsv"]],
	["copy-row-tsv", "Copy Row as TSV", copyTableRowTsv, ["copy-row-tsv", "table-copy-row-tsv"]],
	[
		"copy-column-tsv",
		"Copy Column as TSV",
		copyTableColumnTsv,
		["copy-column-tsv", "table-copy-column-tsv"],
	],
	[
		"copy-selection-tsv",
		"Copy Selection as TSV",
		copyTableSelectionTsv,
		["copy-selection-tsv", "table-copy-selection-tsv"],
	],
	["delete-row", "Delete Row", deleteTableRow, ["delete-row", "table-delete-row"]],
	["delete-column", "Delete Column", deleteTableColumn, ["delete-column", "table-delete-column"]],
	["clear-cell", "Clear Cell", clearTableCell, ["clear-cell", "table-clear-cell"]],
	[
		"clear-selection",
		"Clear Selection",
		clearTableSelection,
		["clear-selection", "table-clear-selection"],
	],
	["delete", "Delete Table", deleteTable, ["delete-table"]],
]

function toCommandEntry(
	[id, label, command, aliases, hotkey]: EditorCommandRow,
	category: string,
	runCommand: (command: EditorCommand) => void,
): CommandEntry {
	return {
		id,
		label,
		category,
		aliases: [...aliases],
		hotkey: hotkey ? { defaultKeys: hotkey, scope: "editor" } : undefined,
		execute: () => runCommand(command),
	}
}

export function createEditorCommandEntries(
	runCommand: (command: EditorCommand) => void,
): CommandEntry[] {
	return [
		...editorCommandRows.map((row) => toCommandEntry(row, "Editor", runCommand)),
		...tableCommandRows.map(([id, ...rest]) =>
			toCommandEntry([`table.${id}`, ...rest], "Table", runCommand),
		),
	]
}
