import { keymap } from "@codemirror/view"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { baseExtensions, DEFAULT_EDITOR_CONFIG } from "../extensions"
import { insertTable } from "../markdownCommands"
import { reconfigureMarkdownKeymap } from "../markdownKeymap"
import { loadEditorRuntime } from "../runtime"
import {
	addTableColumnEnd,
	addTableColumnRight,
	addTableRowAbove,
	addTableRowBelow,
	addTableRowEnd,
	alignTableColumnCenter,
	alignTableColumnLeft,
	alignTableColumnRight,
	copyTableColumnTsv,
	copyTableMarkdown,
	copyTableRowTsv,
	copyTableTsv,
	deleteTableColumn,
	duplicateTableColumn,
	duplicateTableRow,
	getMarkdownTableContext,
	moveTableColumnLeft,
	moveTableColumnRight,
	moveTableColumnToIndex,
	moveTableRowDown,
	moveTableRowToIndex,
	moveTableRowUp,
	parsePastedTableText,
	pasteTableText,
} from "../tableEditing"
import type { EditorRuntimeView } from "../types"

const editorViews: EditorRuntimeView[] = []
let editorRuntime: Awaited<ReturnType<typeof loadEditorRuntime>>

beforeAll(async () => {
	editorRuntime = await loadEditorRuntime()
})

afterEach(() => {
	for (const view of editorViews.splice(0)) view.destroy()
	document.body.replaceChildren()
	vi.restoreAllMocks()
})

function createEditor(content: string, selection = content.length): EditorRuntimeView {
	const parent = document.createElement("div")
	document.body.appendChild(parent)
	const view = new editorRuntime.view.EditorView({
		state: editorRuntime.state.EditorState.create({
			doc: content,
			selection: { anchor: selection },
			extensions: [...baseExtensions(editorRuntime, DEFAULT_EDITOR_CONFIG, { livePreview: false })],
		}),
		parent,
	}) as EditorRuntimeView
	editorViews.push(view)
	return view
}

function runKey(view: EditorRuntimeView, key: string): boolean {
	for (const binding of view.state.facet(keymap).flat()) {
		if (binding.key === key && binding.run?.(view)) return true
	}
	return false
}

function mockClipboard(): ReturnType<typeof vi.fn> {
	const writeText = vi.fn().mockResolvedValue(undefined)
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText },
	})
	return writeText
}

describe("Markdown table editing", () => {
	it("inserts a blank compact 2x2 table with block spacing", () => {
		const view = createEditor("Before")

		expect(insertTable(view)).toBe(true)

		expect(view.state.doc.toString()).toBe("Before\n\n|  |  |\n| --- | --- |\n|  |  |")
		expect(view.state.selection.main.anchor).toBe("Before\n\n".length + 2)
	})

	it("parses escaped pipes without splitting the cell", () => {
		const content = "| Name | Status |\n| --- | --- |\n| A \\| B | Done |"
		const view = createEditor(content, content.indexOf("A"))
		const table = getMarkdownTableContext(view.state)

		expect(table?.rows[1].cells.map((cell) => cell.text)).toEqual(["A \\| B", "Done"])
	})

	it("adds rows and columns as single normalized table edits", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |"
		const view = createEditor(content, content.indexOf("C"))

		expect(addTableRowAbove(view)).toBe(true)
		expect(view.state.doc.toString()).toBe("| A | B |\n| --- | --- |\n|  |  |\n| C | D |")

		expect(addTableColumnRight(view)).toBe(true)
		expect(view.state.doc.toString()).toBe(
			"| A |  | B |\n| --- | --- | --- |\n|  |  |  |\n| C |  | D |",
		)
	})

	it("aligns only the active column delimiter cell", () => {
		const content = "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |"
		const view = createEditor(content, content.indexOf("B"))

		expect(alignTableColumnCenter(view)).toBe(true)
		expect(view.state.doc.toString()).toBe("| A | B | C |\n| --- | :---: | --- |\n| 1 | 2 | 3 |")

		expect(alignTableColumnRight(view)).toBe(true)
		expect(view.state.doc.toString()).toBe("| A | B | C |\n| --- | ---: | --- |\n| 1 | 2 | 3 |")

		expect(alignTableColumnLeft(view)).toBe(true)
		expect(view.state.doc.toString()).toBe("| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |")
	})

	it("duplicates rows and columns while preserving escaped pipes and alignment", () => {
		const rowContent = "| A | B |\n| :---: | ---: |\n| C \\| D | E |"
		const rowView = createEditor(rowContent, rowContent.indexOf("C"))

		expect(duplicateTableRow(rowView)).toBe(true)
		expect(rowView.state.doc.toString()).toBe(
			"| A | B |\n| :---: | ---: |\n| C \\| D | E |\n| C \\| D | E |",
		)
		expect(rowView.state.selection.main.anchor).toBe(rowView.state.doc.toString().lastIndexOf("C"))

		const columnContent = "| A | B |\n| --- | ---: |\n| C | D |"
		const columnView = createEditor(columnContent, columnContent.indexOf("B"))

		expect(duplicateTableColumn(columnView)).toBe(true)
		expect(columnView.state.doc.toString()).toBe(
			"| A | B | B |\n| --- | ---: | ---: |\n| C | D | D |",
		)
		expect(getMarkdownTableContext(columnView.state)?.activeColumnIndex).toBe(2)
	})

	it("moves rows and columns within table boundaries", () => {
		const rowContent = "| H | V |\n| --- | --- |\n| one | 1 |\n| two | 2 |\n| three | 3 |"
		const rowView = createEditor(rowContent, rowContent.indexOf("two"))

		expect(moveTableRowUp(rowView)).toBe(true)
		expect(rowView.state.doc.toString()).toBe(
			"| H | V |\n| --- | --- |\n| two | 2 |\n| one | 1 |\n| three | 3 |",
		)
		expect(rowView.state.selection.main.anchor).toBe(rowView.state.doc.toString().indexOf("two"))

		expect(moveTableRowDown(rowView)).toBe(true)
		expect(rowView.state.doc.toString()).toBe(rowContent)

		const columnContent = "| A | B | C |\n| --- | :---: | ---: |\n| 1 | 2 | 3 |"
		const columnView = createEditor(columnContent, columnContent.indexOf("B"))

		expect(moveTableColumnLeft(columnView)).toBe(true)
		expect(columnView.state.doc.toString()).toBe(
			"| B | A | C |\n| :---: | --- | ---: |\n| 2 | 1 | 3 |",
		)
		expect(getMarkdownTableContext(columnView.state)?.activeColumnIndex).toBe(0)
		expect(moveTableColumnLeft(columnView)).toBe(false)

		expect(moveTableColumnRight(columnView)).toBe(true)
		expect(columnView.state.doc.toString()).toBe(columnContent)
	})

	it("moves rows and columns to an explicit target index for drag reorder", () => {
		const rowContent = "| H | V |\n| --- | --- |\n| one | 1 |\n| two | 2 |\n| three | 3 |"
		const rowView = createEditor(rowContent, rowContent.indexOf("one"))

		expect(moveTableRowToIndex(rowView, 1, 3)).toBe(true)
		expect(rowView.state.doc.toString()).toBe(
			"| H | V |\n| --- | --- |\n| two | 2 |\n| three | 3 |\n| one | 1 |",
		)
		expect(moveTableRowToIndex(rowView, 0, 2)).toBe(false)

		const columnContent = "| A | B | C |\n| --- | :---: | ---: |\n| 1 | 2 | 3 |"
		const columnView = createEditor(columnContent, columnContent.indexOf("B"))

		expect(moveTableColumnToIndex(columnView, 0, 2)).toBe(true)
		expect(columnView.state.doc.toString()).toBe(
			"| B | C | A |\n| :---: | ---: | --- |\n| 2 | 3 | 1 |",
		)
		expect(getMarkdownTableContext(columnView.state)?.activeColumnIndex).toBe(2)
	})

	it("adds rows and columns at the end and places the cursor in the new cell", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |"
		const view = createEditor(content, content.indexOf("B"))

		expect(addTableRowEnd(view)).toBe(true)
		expect(view.state.doc.toString()).toBe("| A | B |\n| --- | --- |\n| C | D |\n|  |  |")
		expect(getMarkdownTableContext(view.state)?.activeRowIndex).toBe(2)
		expect(getMarkdownTableContext(view.state)?.activeColumnIndex).toBe(1)

		expect(addTableColumnEnd(view)).toBe(true)
		expect(view.state.doc.toString()).toBe(
			"| A | B |  |\n| --- | --- | --- |\n| C | D |  |\n|  |  |  |",
		)
		expect(getMarkdownTableContext(view.state)?.activeColumnIndex).toBe(2)

		const targetedRowView = createEditor(content, content.indexOf("A"))
		expect(addTableRowEnd(targetedRowView, 1)).toBe(true)
		expect(getMarkdownTableContext(targetedRowView.state)?.activeColumnIndex).toBe(1)

		const targetedColumnView = createEditor(content, content.indexOf("A"))
		expect(addTableColumnEnd(targetedColumnView, 1)).toBe(true)
		expect(getMarkdownTableContext(targetedColumnView.state)?.activeRowIndex).toBe(1)
	})

	it("prevents deleting the final remaining column", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |"
		const view = createEditor(content, content.indexOf("A"))

		expect(deleteTableColumn(view)).toBe(true)
		expect(view.state.doc.toString()).toBe("| B |\n| --- |\n| D |")
		expect(deleteTableColumn(view)).toBe(false)
		expect(view.state.doc.toString()).toBe("| B |\n| --- |\n| D |")
	})

	it("copies tables and slices as Markdown or TSV", () => {
		const content = "| A | B |\n| :---: | ---: |\n| C \\| D | E |"
		const view = createEditor(content, content.indexOf("E"))
		const writeText = mockClipboard()

		expect(copyTableMarkdown(view)).toBe(true)
		expect(writeText).toHaveBeenLastCalledWith(content)

		expect(copyTableTsv(view)).toBe(true)
		expect(writeText).toHaveBeenLastCalledWith("A\tB\nC | D\tE")

		expect(copyTableRowTsv(view)).toBe(true)
		expect(writeText).toHaveBeenLastCalledWith("C | D\tE")

		expect(copyTableColumnTsv(view)).toBe(true)
		expect(writeText).toHaveBeenLastCalledWith("B\nE")

		const plainView = createEditor("plain", 0)
		expect(copyTableMarkdown(plainView)).toBe(false)
		expect(copyTableTsv(plainView)).toBe(false)
	})

	it("expands the current table when TSV content is pasted into a cell", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |"
		const view = createEditor(content, content.indexOf("D"))

		expect(pasteTableText(view, "x\ty\nz\tw")).toBe(true)

		expect(view.state.doc.toString()).toBe(
			"| A | B |  |\n| --- | --- | --- |\n| C | x | y |\n|  | z | w |",
		)
	})

	it("accepts Markdown table paste and rejects malformed tables", () => {
		expect(parsePastedTableText("| A | B |\n| --- | --- |\n| C | D |")).toEqual([
			["A", "B"],
			["C", "D"],
		])
		expect(parsePastedTableText("| A | B |\n| nope |")).toBeNull()
	})

	it("turns structured selections into normalized tables", () => {
		const tsv = "Name\tAge\nAna\t20"
		const tsvView = createEditor(tsv, 0)
		tsvView.dispatch({ selection: { anchor: 0, head: tsv.length } })

		expect(insertTable(tsvView)).toBe(true)
		expect(tsvView.state.doc.toString()).toBe("| Name | Age |\n| --- | --- |\n| Ana | 20 |")
		expect(tsvView.state.selection.main.anchor).toBe(2)

		const markdown = "| A | B |\n| :---: | ---: |\n| C | D |"
		const markdownView = createEditor(markdown, 0)
		markdownView.dispatch({ selection: { anchor: 0, head: markdown.length } })

		expect(insertTable(markdownView)).toBe(true)
		expect(markdownView.state.doc.toString()).toBe(markdown)

		const multiline = "Alpha\nBeta"
		const multilineView = createEditor(multiline, 0)
		multilineView.dispatch({ selection: { anchor: 0, head: multiline.length } })

		expect(insertTable(multilineView)).toBe(true)
		expect(multilineView.state.doc.toString()).toBe("| Alpha |\n| --- |\n| Beta |")
	})

	it("moves through cells with table-local key bindings", async () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |"
		const view = createEditor(content, content.indexOf("A"))

		expect(runKey(view, "Tab")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("B"))

		expect(runKey(view, "Shift-Tab")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("A"))

		expect(runKey(view, "Enter")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("C"))

		await reconfigureMarkdownKeymap(
			view,
			[{ id: "table.add-row-below", keys: "mod+enter", enabled: true }],
			(commandId, editorView) =>
				commandId === "table.add-row-below" ? addTableRowBelow(editorView) : false,
		)

		expect(runKey(view, "Mod-Enter")).toBe(true)
		expect(view.state.doc.toString()).toBe("| A | B |\n| --- | --- |\n| C | D |\n|  |  |")
	})

	it("moves horizontally through cell edges without landing on hidden pipes", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |"
		const view = createEditor(content, content.indexOf("B"))

		expect(runKey(view, "ArrowLeft")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("A"))

		view.dispatch({ selection: { anchor: content.indexOf("A") + 1 } })
		expect(runKey(view, "ArrowRight")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("B"))

		view.dispatch({ selection: { anchor: content.indexOf("D") + 1 } })
		expect(runKey(view, "ArrowRight")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("D") + 1)
		expect(view.state.doc.toString()).toBe(content)
	})
})
