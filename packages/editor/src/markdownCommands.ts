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
	copyTableColumnTsv,
	copyTableMarkdown,
	copyTableRowTsv,
	copyTableTsv,
	createDefaultTableInsertion,
	createStructuredTableInsertion,
	deleteTable,
	deleteTableColumn,
	deleteTableRow,
	duplicateTableColumn,
	duplicateTableRow,
	isSelectionInsideTable,
	moveTableColumnLeft,
	moveTableColumnRight,
	moveTableRowDown,
	moveTableRowUp,
} from "./tableEditing"
import {
	clearTableSelection,
	copyTableSelectionTsv,
	hasTableCellSelection,
	hasTableVisualSelection,
} from "./tableSelection"
import type { EditorRuntimeView } from "./types"

function wrapOrInsert(view: EditorRuntimeView, marker: string): boolean {
	const { state } = view
	const { from, to } = state.selection.main
	const selected = state.sliceDoc(from, to)

	if (from !== to) {
		if (
			selected.startsWith(marker) &&
			selected.endsWith(marker) &&
			selected.length > marker.length * 2
		) {
			view.dispatch({
				changes: { from, to, insert: selected.slice(marker.length, -marker.length) },
				selection: { anchor: from, head: to - marker.length * 2 },
			})
		} else {
			view.dispatch({
				changes: { from, to, insert: `${marker}${selected}${marker}` },
				selection: { anchor: from, head: to + marker.length * 2 },
			})
		}
	} else {
		view.dispatch({
			changes: { from, insert: `${marker}${marker}` },
			selection: { anchor: from + marker.length },
		})
	}
	return true
}

function toggleLinePrefix(view: EditorRuntimeView, prefix: string): boolean {
	const { state } = view
	const line = state.doc.lineAt(state.selection.main.head)

	if (line.text.startsWith(prefix)) {
		view.dispatch({
			changes: { from: line.from, to: line.from + prefix.length, insert: "" },
			selection: { anchor: Math.max(line.from, state.selection.main.head - prefix.length) },
		})
	} else {
		const stripped = stripBlockPrefixes(line.text)
		const strippedLength = line.text.length - stripped.length
		view.dispatch({
			changes: { from: line.from, to: line.from + strippedLength, insert: prefix },
			selection: { anchor: state.selection.main.head + (prefix.length - strippedLength) },
		})
	}
	return true
}

function stripBlockPrefixes(text: string): string {
	return text
		.replace(/^#{1,6} /, "")
		.replace(/^> /, "")
		.replace(/^- \[[ x]\] /, "")
		.replace(/^- /, "")
		.replace(/^\d+\. /, "")
}

export function toggleBold(view: EditorRuntimeView): boolean {
	return wrapOrInsert(view, "**")
}

export function toggleItalic(view: EditorRuntimeView): boolean {
	return wrapOrInsert(view, "*")
}

export function toggleStrikethrough(view: EditorRuntimeView): boolean {
	return wrapOrInsert(view, "~~")
}

export function toggleInlineCode(view: EditorRuntimeView): boolean {
	return wrapOrInsert(view, "`")
}

export function insertInlineMath(view: EditorRuntimeView): boolean {
	const { state } = view
	const { from, to } = state.selection.main
	const selected = state.sliceDoc(from, to)

	if (selected.includes("\n")) return insertMathBlock(view)

	return wrapOrInsert(view, "$")
}

export function insertMathBlock(view: EditorRuntimeView): boolean {
	const { state } = view
	const { from, to } = state.selection.main
	const selected = state.sliceDoc(from, to)

	if (from === to) {
		view.dispatch({
			changes: { from, insert: "$$\n\n$$" },
			selection: { anchor: from + 3 },
		})
		return true
	}

	const insertion = `$$\n${selected}\n$$`
	view.dispatch({
		changes: { from, to, insert: insertion },
		selection: { anchor: from + 3, head: from + 3 + selected.length },
	})
	return true
}

export function insertLink(view: EditorRuntimeView): boolean {
	const { state } = view
	const { from, to } = state.selection.main
	const selected = state.sliceDoc(from, to)

	if (from !== to) {
		view.dispatch({
			changes: { from, to, insert: `[${selected}](url)` },
			selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
		})
	} else {
		view.dispatch({
			changes: { from, insert: "[](url)" },
			selection: { anchor: from + 1 },
		})
	}
	return true
}

export function insertImage(view: EditorRuntimeView): boolean {
	const { state } = view
	const { from, to } = state.selection.main
	const selected = state.sliceDoc(from, to)
	const alt = from !== to ? selected : "alt"

	view.dispatch({
		changes: { from, to, insert: `![${alt}](url)` },
		selection: { anchor: from + alt.length + 5, head: from + alt.length + 8 },
	})
	return true
}

export function toggleHeading(view: EditorRuntimeView, level: 1 | 2 | 3): boolean {
	const { state } = view
	const line = state.doc.lineAt(state.selection.main.head)
	const prefix = `${"#".repeat(level)} `
	const existingHeadingMatch = line.text.match(/^(#{1,6}) /)

	if (existingHeadingMatch) {
		const existingPrefix = existingHeadingMatch[0]
		if (existingHeadingMatch[1].length === level) {
			view.dispatch({
				changes: { from: line.from, to: line.from + existingPrefix.length, insert: "" },
				selection: {
					anchor: Math.max(line.from, state.selection.main.head - existingPrefix.length),
				},
			})
		} else {
			view.dispatch({
				changes: { from: line.from, to: line.from + existingPrefix.length, insert: prefix },
				selection: { anchor: state.selection.main.head + (prefix.length - existingPrefix.length) },
			})
		}
	} else {
		view.dispatch({
			changes: { from: line.from, insert: prefix },
			selection: { anchor: state.selection.main.head + prefix.length },
		})
	}
	return true
}

export function toggleBlockquote(view: EditorRuntimeView): boolean {
	return toggleLinePrefix(view, "> ")
}

export function insertCodeBlock(view: EditorRuntimeView): boolean {
	const { state } = view
	const { from } = state.selection.main

	view.dispatch({
		changes: { from, insert: "```\n\n```" },
		selection: { anchor: from + 4 },
	})
	return true
}

export function insertTable(view: EditorRuntimeView): boolean {
	const { state } = view
	const { from, to } = state.selection.main
	const insertion =
		from === to
			? createDefaultTableInsertion(state, from, to)
			: (createStructuredTableInsertion(state, from, to) ??
				createDefaultTableInsertion(state, from, to))

	view.dispatch({
		changes: { from: insertion.from, to: insertion.to, insert: insertion.markdown },
		selection: { anchor: from + insertion.selectionOffset },
	})
	return true
}

export {
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
	copyTableColumnTsv,
	copyTableMarkdown,
	copyTableRowTsv,
	copyTableSelectionTsv,
	copyTableTsv,
	deleteTable,
	deleteTableColumn,
	deleteTableRow,
	duplicateTableColumn,
	duplicateTableRow,
	hasTableCellSelection,
	hasTableVisualSelection,
	isSelectionInsideTable,
	moveTableColumnLeft,
	moveTableColumnRight,
	moveTableRowDown,
	moveTableRowUp,
}

export function insertCallout(view: EditorRuntimeView, type = "note"): boolean {
	const { state } = view
	const { from } = state.selection.main
	const normalizedType = type.trim().toUpperCase() || "NOTE"
	const marker = `> [!${normalizedType}]\n> `

	view.dispatch({
		changes: { from, insert: marker },
		selection: { anchor: from + marker.length },
	})
	return true
}

export function toggleTaskList(view: EditorRuntimeView): boolean {
	const { state } = view
	const line = state.doc.lineAt(state.selection.main.head)
	const taskMatch = line.text.match(/^(\s*- \[)( |x)(\] )/)

	if (taskMatch) {
		const checkChar = taskMatch[2] === " " ? "x" : " "
		const checkOffset = line.from + taskMatch[1].length
		view.dispatch({
			changes: { from: checkOffset, to: checkOffset + 1, insert: checkChar },
		})
	} else {
		const stripped = stripBlockPrefixes(line.text)
		const strippedLength = line.text.length - stripped.length
		const prefix = "- [ ] "
		view.dispatch({
			changes: { from: line.from, to: line.from + strippedLength, insert: prefix },
			selection: { anchor: state.selection.main.head + (prefix.length - strippedLength) },
		})
	}
	return true
}

export function toggleUnorderedList(view: EditorRuntimeView): boolean {
	return toggleLinePrefix(view, "- ")
}

export function toggleOrderedList(view: EditorRuntimeView): boolean {
	return toggleLinePrefix(view, "1. ")
}

export function duplicateLine(view: EditorRuntimeView): boolean {
	const { state } = view
	const line = state.doc.lineAt(state.selection.main.head)
	const lineText = line.text

	view.dispatch({
		changes: { from: line.to, insert: `\n${lineText}` },
		selection: { anchor: line.to + 1 + (state.selection.main.head - line.from) },
	})
	return true
}

export function copyLine(view: EditorRuntimeView): boolean {
	const { state } = view
	const line = state.doc.lineAt(state.selection.main.head)
	navigator.clipboard.writeText(line.text)
	return true
}

export function removeParagraphFormatting(view: EditorRuntimeView): boolean {
	const { state } = view
	const line = state.doc.lineAt(state.selection.main.head)
	const stripped = stripBlockPrefixes(line.text)
	const strippedLength = line.text.length - stripped.length

	if (strippedLength === 0) return false

	view.dispatch({
		changes: { from: line.from, to: line.from + strippedLength, insert: "" },
		selection: { anchor: Math.max(line.from, state.selection.main.head - strippedLength) },
	})
	return true
}
