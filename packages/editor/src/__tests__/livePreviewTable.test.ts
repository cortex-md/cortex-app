// @ts-expect-error Tests read CSS fixtures through Node's built-in fs module.
import { readFileSync } from "node:fs"
import { markdown } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import { GFM } from "@lezer/markdown"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { livePreviewExtension } from "../livePreview"
import { insertTable } from "../markdownCommands"
import { defaultMarkdownKeymapExtension } from "../markdownKeymap"
import { loadEditorRuntime } from "../runtime"
import { tableAffordancesExtension } from "../tableAffordances"
import {
	alignTableColumnCenter,
	duplicateTableColumn,
	moveTableColumnRight,
	tableEditingExtension,
} from "../tableEditing"
import { tableResizeExtension } from "../tableResize"
import { tableSelectionExtension } from "../tableSelection"

const editorViews: EditorView[] = []
let editorRuntime: Awaited<ReturnType<typeof loadEditorRuntime>>

beforeAll(async () => {
	editorRuntime = await loadEditorRuntime()
})

afterEach(() => {
	for (const view of editorViews.splice(0)) view.destroy()
	document.body.replaceChildren()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

function createEditor(content: string): EditorView {
	const parent = document.createElement("div")
	document.body.appendChild(parent)
	const view = new EditorView({
		state: EditorState.create({
			doc: content,
			selection: { anchor: content.length },
			extensions: [
				tableEditingExtension(editorRuntime),
				defaultMarkdownKeymapExtension(editorRuntime),
				markdown({ extensions: GFM }),
				livePreviewExtension(editorRuntime),
				tableSelectionExtension(editorRuntime),
				tableAffordancesExtension(editorRuntime),
				tableResizeExtension(editorRuntime),
			],
		}),
		parent,
	})
	editorViews.push(view)
	return view
}

function runKey(view: EditorView, key: string): boolean {
	for (const binding of view.state.facet(keymap).flat()) {
		if (binding.key === key && binding.run?.(view)) return true
	}
	return false
}

function clickTableCell(cell: Element | null): void {
	expect(cell).not.toBeNull()
	cell?.dispatchEvent(
		new MouseEvent("pointerdown", {
			bubbles: true,
			button: 0,
			cancelable: true,
		}),
	)
}

function shiftClickTableCell(cell: Element | null): void {
	expect(cell).not.toBeNull()
	cell?.dispatchEvent(
		new MouseEvent("pointerdown", {
			bubbles: true,
			button: 0,
			cancelable: true,
			shiftKey: true,
		}),
	)
}

function dragTableSelection(from: Element | null, to: Element | null): void {
	shiftClickTableCell(from)
	expect(to).not.toBeNull()
	to?.dispatchEvent(
		new MouseEvent("pointermove", {
			bubbles: true,
			button: 0,
			cancelable: true,
			shiftKey: true,
		}),
	)
	document.dispatchEvent(
		new MouseEvent("pointerup", {
			bubbles: true,
			button: 0,
			cancelable: true,
		}),
	)
}

function dragVisualTableSelection(from: Element | null, to: Element | null): void {
	expect(from).not.toBeNull()
	expect(to).not.toBeNull()
	from?.dispatchEvent(
		new MouseEvent("pointerdown", {
			bubbles: true,
			button: 0,
			cancelable: true,
			clientX: 1,
			clientY: 1,
		}),
	)
	to?.dispatchEvent(
		new MouseEvent("pointermove", {
			bubbles: true,
			button: 0,
			cancelable: true,
			clientX: 40,
			clientY: 40,
		}),
	)
	document.dispatchEvent(
		new MouseEvent("pointerup", {
			bubbles: true,
			button: 0,
			cancelable: true,
			clientX: 40,
			clientY: 40,
		}),
	)
}

function hoverTableCell(cell: Element | null, position = { x: 8, y: 8 }): void {
	expect(cell).not.toBeNull()
	cell?.dispatchEvent(
		new MouseEvent("pointerover", {
			bubbles: true,
			cancelable: true,
			clientX: position.x,
			clientY: position.y,
		}),
	)
}

function movePointer(element: Element | null, position: { x: number; y: number }): void {
	expect(element).not.toBeNull()
	element?.dispatchEvent(
		new MouseEvent("pointermove", {
			bubbles: true,
			cancelable: true,
			clientX: position.x,
			clientY: position.y,
		}),
	)
}

function clickElement(element: Element | null): void {
	expect(element).not.toBeNull()
	element?.dispatchEvent(
		new MouseEvent("pointerdown", {
			bubbles: true,
			button: 0,
			cancelable: true,
		}),
	)
	element?.dispatchEvent(
		new MouseEvent("click", {
			bubbles: true,
			button: 0,
			cancelable: true,
		}),
	)
}

function typeTextThroughDom(view: EditorView, text: string): void {
	view.focus()
	for (const character of text) {
		view.contentDOM.dispatchEvent(
			new InputEvent("beforeinput", {
				bubbles: true,
				cancelable: true,
				data: character,
				inputType: "insertText",
			}),
		)
	}
}

function dispatchEditorKey(
	view: EditorView,
	key: string,
	options: Partial<KeyboardEventInit> = {},
): void {
	view.contentDOM.dispatchEvent(
		new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key,
			...options,
		}),
	)
}

function pasteTextIntoEditor(view: EditorView, text: string): void {
	const event = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent
	Object.defineProperty(event, "clipboardData", {
		value: {
			getData: (type: string) => (type === "text/plain" ? text : ""),
		},
	})
	view.contentDOM.dispatchEvent(event)
}

function mockRect(element: Element, rect: Partial<DOMRect>): void {
	vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
		bottom: rect.bottom ?? 20,
		height: rect.height ?? 20,
		left: rect.left ?? 0,
		right: rect.right ?? 80,
		toJSON: () => ({}),
		top: rect.top ?? 0,
		width: rect.width ?? 80,
		x: rect.x ?? rect.left ?? 0,
		y: rect.y ?? rect.top ?? 0,
	} as DOMRect)
}

function mockTextHitRect(rect: Partial<DOMRect>): void {
	vi.spyOn(document, "createRange").mockImplementation(
		() =>
			({
				detach: vi.fn(),
				getClientRects: () =>
					[
						{
							bottom: rect.bottom ?? 20,
							height: rect.height ?? 20,
							left: rect.left ?? 0,
							right: rect.right ?? 40,
							toJSON: () => ({}),
							top: rect.top ?? 0,
							width: rect.width ?? 40,
							x: rect.x ?? rect.left ?? 0,
							y: rect.y ?? rect.top ?? 0,
						},
					] as unknown as DOMRectList,
				selectNodeContents: vi.fn(),
			}) as unknown as Range,
	)
}

function readTestAsset(path: string): string {
	try {
		return readFileSync(path, "utf8")
	} catch {
		return readFileSync(`packages/editor/${path}`, "utf8")
	}
}

function readCssRule(css: string, selector: string): string {
	const start = css.indexOf(`${selector} {`)
	expect(start).toBeGreaterThanOrEqual(0)
	const end = css.indexOf("\n}", start)
	expect(end).toBeGreaterThan(start)
	return css.slice(start, end)
}

describe("GFM inline rendering", () => {
	it("keeps responsive table CSS aligned across live preview and markdown surfaces", () => {
		const livePreviewCss = readTestAsset("src/livePreview/styles.css")
		const markdownCss = readTestAsset("src/markdown.css")
		const livePreviewWrapperRule = readCssRule(livePreviewCss, ".cm-table-wrapper")
		const livePreviewRowRule = readCssRule(livePreviewCss, ".cm-line.cm-table-rendered-line")
		const livePreviewCellRule = readCssRule(livePreviewCss, ".cm-table-cell")
		const livePreviewSelectionRule = readCssRule(
			livePreviewCss,
			".cm-table-cell.cm-table-cell-selected",
		)
		const livePreviewDelimiterRule = readCssRule(livePreviewCss, ".cm-line.cm-table-delimiter-line")
		const affordanceLayerRule = readCssRule(livePreviewCss, ".cm-table-affordance-layer")
		const affordanceHandleRule = readCssRule(livePreviewCss, ".cm-table-affordance-handle")
		const affordanceAddRule = readCssRule(livePreviewCss, ".cm-table-affordance-add-button")
		const resizeLayerRule = readCssRule(livePreviewCss, ".cm-table-resize-layer")
		const resizeHandleRule = readCssRule(livePreviewCss, ".cm-table-column-resize-handle")
		const markdownTableRule = readCssRule(markdownCss, ".markdown-surface table")

		for (const css of [livePreviewCss, markdownCss]) {
			expect(css).toContain("--markdown-table-cell-min")
			expect(css).toContain("--markdown-table-cell-max")
			expect(css).toContain("overflow-x: auto")
			expect(css).toContain("overflow-wrap: anywhere")
			expect(css).toContain("white-space: pre-wrap")
			expect(css).toContain("var(--text-primary)")
			expect(css).toContain("font-weight: 500")
		}
		expect(livePreviewCss).not.toContain("--table-cell-width")
		expect(livePreviewCss).not.toContain("data-table-cell-width")
		expect(livePreviewCellRule).not.toContain("display: inline-block")
		expect(livePreviewRowRule).toContain("display: table-row")
		expect(livePreviewCellRule).toContain("display: table-cell")
		expect(livePreviewCellRule).toContain("border-inline-end: 1px solid var(--border-subtle)")
		expect(livePreviewWrapperRule).toContain("border: 1px solid var(--border-subtle)")
		expect(livePreviewSelectionRule).toContain("var(--editor-selection-bg)")
		expect(livePreviewSelectionRule).not.toContain("display:")
		expect(livePreviewDelimiterRule).toContain("visibility: collapse")
		expect(livePreviewWrapperRule).not.toContain("box-shadow")
		expect(livePreviewCss).toContain("font-size: 0")
		expect(livePreviewCss).toContain("color-mix(in srgb, var(--editor-selection-bg)")
		expect(affordanceLayerRule).toContain("pointer-events: none")
		expect(affordanceHandleRule).toContain("pointer-events: auto")
		expect(affordanceHandleRule).toContain("cursor: grab")
		expect(affordanceAddRule).toContain("position: absolute")
		expect(affordanceAddRule).toContain("pointer-events: auto")
		expect(resizeLayerRule).toContain("pointer-events: none")
		expect(resizeHandleRule).toContain("cursor: col-resize")
		expect(resizeHandleRule).toContain("pointer-events: auto")
		expect(livePreviewCss).toContain("--cm-table-column-width")
		expect(livePreviewCss).not.toContain(".cm-table-affordance-menu")
		expect(markdownTableRule).toContain("inline-size: fit-content")
		expect(markdownTableRule).not.toContain("box-shadow")
	})

	it("does not store source-derived width metadata on rendered table cells", () => {
		createEditor(
			"| Nome | Idade | Altura |\n| --- | --- | --- |\n| Lucas | 20 | 1.20 |\n| longvalue | a | b |",
		)
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		expect(cells).toHaveLength(9)
		expect(cells.every((cell) => cell.dataset.tableCellWidth === undefined)).toBe(true)
		expect(cells.every((cell) => !cell.style.getPropertyValue("--table-cell-width"))).toBe(true)
	})

	it("keeps one visual cell wrapper when inline marks render inside cells", () => {
		createEditor("| **Nome** | Idade |\n| --- | --- |\n| Lucas | **20** |\n\ntail")
		const renderedRows = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-rendered-line"),
		)
		const editableCellCounts = renderedRows.map((row) => {
			return row.querySelectorAll(".cm-table-cell:not(.cm-table-delimiter-cell)").length
		})

		expect(editableCellCounts).toEqual([2, 0, 2])
		expect(document.querySelector(".cm-table-wrapper .cm-bold")?.textContent).toBe("Nome")
	})

	it("keeps semantic formatting in text, tables, and callouts", () => {
		createEditor(`**outside** *italic* ~~strike~~

| Value | Link |
| --- | --- |
| **bold** and *italic* | [link](https://example.com) |

> [!warning]+ **Title**
> Body with *emphasis* and ~~strike~~.`)

		expect(document.querySelector(".cm-table-wrapper .cm-bold")?.textContent).toBe("bold")
		expect(document.querySelector(".cm-table-wrapper .cm-italic")?.textContent).toBe("italic")
		expect(document.querySelector(".cm-table-wrapper .cm-link")?.textContent).toBe("link")
		expect(document.querySelectorAll(".cm-bold").length).toBeGreaterThanOrEqual(1)
		expect(document.querySelectorAll(".cm-italic").length).toBeGreaterThanOrEqual(1)
		expect(document.querySelectorAll(".cm-strikethrough").length).toBeGreaterThanOrEqual(1)
	})

	it("keeps the rendered table visible while a selection crosses the block", () => {
		const content = "| A | B |\n| --- | --- |\n| **bold** | value |\n\ntail"
		const view = createEditor(content)
		expect(document.querySelector(".cm-table-wrapper")).not.toBeNull()
		expect(document.querySelector(".cm-table-rendered-line")).not.toBeNull()
		expect(document.querySelector(".cm-table-cell")).not.toBeNull()

		view.dispatch({ selection: { anchor: 0, head: content.indexOf("tail") } })

		expect(document.querySelector(".cm-table-wrapper")).not.toBeNull()
		expect(document.querySelector(".cm-table-rendered-line")).not.toBeNull()
		expect(document.querySelector(".cm-table-cell")).not.toBeNull()
		expect(document.querySelector(".cm-table-source-line")).toBeNull()
		expect(document.querySelector(".cm-table-wrapper .cm-bold")?.textContent).toBe("bold")
	})

	it("keeps the rendered table visible for a collapsed cursor inside a cell", () => {
		const content = "|  |  |\n| --- | --- |\n|  |  |\n\ntail"
		const view = createEditor(content)

		view.dispatch({ selection: { anchor: 2 } })

		expect(document.querySelector(".cm-table-wrapper")).not.toBeNull()
		expect(document.querySelector(".cm-table-rendered-line")).not.toBeNull()
		expect(document.querySelector(".cm-table-source-line")).toBeNull()
		expect(document.querySelector(".cm-table-cell-empty")).not.toBeNull()
	})

	it("places the cursor inside the first empty cell from the rendered hit target", () => {
		const content = "|  |  |\n| --- | --- |\n|  |  |\n\ntail"
		const view = createEditor(content)
		const firstCell = document.querySelector(".cm-table-cell-empty")

		clickTableCell(firstCell)

		expect(view.state.selection.main.anchor).toBe(2)
		typeTextThroughDom(view, "A")
		expect(view.state.doc.toString()).toBe("| A |  |\n| --- | --- |\n|  |  |\n\ntail")
		expect(document.querySelector(".cm-table-rendered-line")).not.toBeNull()
	})

	it("places the cursor inside the first column when clicking rendered text", () => {
		const content = "| Alpha | Beta |\n| --- | --- |\n| Gamma | Delta |\n\ntail"
		const view = createEditor(content)
		const alphaCell = Array.from(document.querySelectorAll<HTMLElement>(".cm-table-cell")).find(
			(cell) => cell.textContent === "Alpha",
		)

		clickTableCell(alphaCell ?? null)

		expect(view.state.selection.main.anchor).toBe(content.indexOf("Alpha"))
	})

	it("places the cursor in the first column from row padding hit testing", () => {
		const content = "| Alpha | Beta |\n| --- | --- |\n| Gamma | Delta |\n\ntail"
		const view = createEditor(content)
		const row = document.querySelector<HTMLElement>(".cm-table-rendered-line")
		const cells = Array.from(
			row?.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)") ?? [],
		)

		expect(row).not.toBeNull()
		expect(cells).toHaveLength(2)
		mockRect(cells[0], { left: 0, right: 80, width: 80 })
		mockRect(cells[1], { left: 80, right: 160, width: 80 })

		row?.dispatchEvent(
			new MouseEvent("pointerdown", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 4,
				clientY: 10,
			}),
		)

		expect(view.state.selection.main.anchor).toBe(content.indexOf("Alpha"))
	})

	it("places the cursor from empty visual space inside a non-empty cell", () => {
		const content = "| Alpha | Beta |\n| --- | --- |\n| Gamma | Delta |\n\ntail"
		const view = createEditor(content)
		const row = document.querySelector<HTMLElement>(".cm-table-rendered-line")
		const cells = Array.from(
			row?.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)") ?? [],
		)

		expect(row).not.toBeNull()
		expect(cells).toHaveLength(2)
		mockRect(cells[0], { left: 0, right: 80, width: 80 })
		mockRect(cells[1], { left: 80, right: 180, width: 100 })

		row?.dispatchEvent(
			new MouseEvent("pointerdown", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 168,
				clientY: 10,
			}),
		)

		expect(view.state.selection.main.anchor).toBe(content.indexOf("Beta"))
		typeTextThroughDom(view, "X")
		expect(view.state.doc.toString()).toContain("| Alpha | XBeta |")
	})

	it("places the cursor from wrapper hit testing when clicking empty cell area", () => {
		const content = "| Alpha | Beta |\n| --- | --- |\n| Gamma | Delta |\n\ntail"
		const view = createEditor(content)
		const wrapper = document.querySelector<HTMLElement>(".cm-table-wrapper")
		const row = document.querySelector<HTMLElement>(".cm-table-rendered-line")
		const cells = Array.from(
			row?.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)") ?? [],
		)

		expect(wrapper).not.toBeNull()
		expect(row).not.toBeNull()
		expect(cells).toHaveLength(2)
		mockRect(row!, { top: 0, bottom: 20, height: 20, left: 0, right: 180, width: 180 })
		mockRect(cells[0], { left: 0, right: 80, width: 80 })
		mockRect(cells[1], { left: 80, right: 180, width: 100 })

		wrapper?.dispatchEvent(
			new MouseEvent("pointerdown", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 168,
				clientY: 10,
			}),
		)

		expect(view.state.selection.main.anchor).toBe(content.indexOf("Beta"))
		typeTextThroughDom(view, "Y")
		expect(view.state.doc.toString()).toContain("| Alpha | YBeta |")
	})

	it("navigates rendered table cells after pointer placement", () => {
		const content = "|  |  |\n| --- | --- |\n|  |  |"
		const view = createEditor(content)

		clickTableCell(document.querySelector(".cm-table-cell-empty"))

		expect(runKey(view, "Tab")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(5)

		expect(runKey(view, "Shift-Tab")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(2)

		expect(runKey(view, "Enter")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.lastIndexOf("|  |  |") + 2)

		view.dispatch({ selection: { anchor: content.lastIndexOf("|  |  |") + 5 } })
		expect(runKey(view, "Tab")).toBe(true)
		expect(view.state.doc.toString()).toBe("|  |  |\n| --- | --- |\n|  |  |\n|  |  |")
	})

	it("selects a rectangular table range with Shift+click without revealing table source", () => {
		const content = "| A | B | C |\n| --- | --- | --- |\n| D | E | F |\n| G | H | I |"
		const view = createEditor(content)
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		view.dispatch({ selection: { anchor: content.indexOf("A") } })
		shiftClickTableCell(cells[5])

		const selectedCells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell-selected"),
		)
		expect(selectedCells.map((cell) => cell.textContent)).toEqual(["A", "B", "C", "D", "E", "F"])
		expect(document.querySelectorAll(".cm-table-cell-selection-anchor")).toHaveLength(1)
		expect(document.querySelector(".cm-table-delimiter-cell.cm-table-cell-selected")).toBeNull()
		expect(document.querySelector(".cm-table-source-line")).toBeNull()
		expect(view.state.selection.main.empty).toBe(true)
	})

	it("updates rectangular table selection with Shift+drag", () => {
		const content = "| A | B | C |\n| --- | --- | --- |\n| D | E | F |\n| G | H | I |"
		const view = createEditor(content)
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		view.dispatch({ selection: { anchor: content.indexOf("A") } })
		dragTableSelection(cells[1], cells[7])

		expect(
			Array.from(document.querySelectorAll<HTMLElement>(".cm-table-cell-selected")).map(
				(cell) => cell.textContent,
			),
		).toEqual(["A", "B", "D", "E", "G", "H"])
		expect(document.querySelector(".cm-table-source-line")).toBeNull()
	})

	it("clears table cell selection on a simple click and keeps typing native", () => {
		const view = createEditor("| A | B | C |\n| --- | --- | --- |\n| D | E | F |")
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		clickTableCell(cells[0])
		shiftClickTableCell(cells[5])
		expect(document.querySelector(".cm-table-cell-selected")).not.toBeNull()

		clickTableCell(cells[0])
		typeTextThroughDom(view, "X")

		expect(document.querySelector(".cm-table-cell-selected")).toBeNull()
		expect(view.state.doc.toString()).toBe("| XA | B | C |\n| --- | --- | --- |\n| D | E | F |")
	})

	it("copies a visual table cell selection as TSV with Mod+C", () => {
		const writeText = vi.fn()
		vi.stubGlobal("navigator", { clipboard: { writeText } })
		const content = "| A | B | C |\n| --- | --- | --- |\n| D | E | F |"
		const view = createEditor(content)
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		view.dispatch({ selection: { anchor: content.indexOf("B") } })
		shiftClickTableCell(cells[5])
		dispatchEditorKey(view, "c", { metaKey: true })

		expect(writeText).toHaveBeenCalledWith("B\tC\nE\tF")
	})

	it("selects the whole table visually with normal drag and copies Markdown", () => {
		const writeText = vi.fn()
		vi.stubGlobal("navigator", { clipboard: { writeText } })
		const content = "| A | B |\n| --- | --- |\n| C | D |\n\ntail"
		const view = createEditor(content)
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		dragVisualTableSelection(cells[0], cells[3])
		dispatchEditorKey(view, "c", { metaKey: true })

		expect(document.querySelector(".cm-table-wrapper.cm-table-selected")).not.toBeNull()
		expect(document.querySelector(".cm-table-source-line")).toBeNull()
		expect(writeText).toHaveBeenCalledWith("| A | B |\n| --- | --- |\n| C | D |")
	})

	it("deletes the whole table when a visual table selection is active", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |\n\ntail"
		const view = createEditor(content)
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		dragVisualTableSelection(cells[0], cells[3])
		dispatchEditorKey(view, "Delete")

		expect(view.state.doc.toString()).toBe("\n\ntail")
		expect(document.querySelector(".cm-table-wrapper")).toBeNull()
	})

	it("clears all cells in a visual selection with Delete", () => {
		const content = "| A | B | C |\n| --- | --- | --- |\n| D | E | F |"
		const view = createEditor(content)
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		view.dispatch({ selection: { anchor: content.indexOf("B") } })
		shiftClickTableCell(cells[4])
		dispatchEditorKey(view, "Delete")

		expect(view.state.doc.toString()).toBe("| A |  | C |\n| --- | --- | --- |\n| D |  | F |")
		expect(document.querySelector(".cm-table-cell-selected")).toBeNull()
	})

	it("pastes TSV over a visual selection from the top-left and expands columns", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |"
		const view = createEditor(content)
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		view.dispatch({ selection: { anchor: content.indexOf("B") } })
		shiftClickTableCell(cells[1])
		pasteTextIntoEditor(view, "X\tY\nZ\tW")

		expect(view.state.doc.toString()).toBe("| A | X | Y |\n| --- | --- | --- |\n| C | Z | W |")
		expect(document.querySelector(".cm-table-cell-selected")).toBeNull()
	})

	it("pastes plain text across every cell in a visual selection", () => {
		const view = createEditor("| A | B |\n| --- | --- |\n| C | D |")
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		clickTableCell(cells[0])
		shiftClickTableCell(cells[3])
		pasteTextIntoEditor(view, "same value")

		expect(view.state.doc.toString()).toBe(
			"| same value | same value |\n| --- | --- |\n| same value | same value |",
		)
		expect(document.querySelector(".cm-table-cell-selected")).toBeNull()
	})

	it("clears visual table selection on Escape and document changes", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |"
		const view = createEditor(content)
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		view.dispatch({ selection: { anchor: content.indexOf("A") } })
		shiftClickTableCell(cells[3])
		dispatchEditorKey(view, "Escape")
		expect(document.querySelector(".cm-table-cell-selected")).toBeNull()

		view.dispatch({ selection: { anchor: content.indexOf("A") } })
		shiftClickTableCell(cells[3])
		expect(document.querySelector(".cm-table-cell-selected")).not.toBeNull()
		view.dispatch({ changes: { from: 0, insert: "x" } })
		expect(document.querySelector(".cm-table-cell-selected")).toBeNull()
	})

	it("keeps Live Preview rendered while selecting text inside one cell", () => {
		const content = "| Alpha | Beta |\n| --- | --- |\n| Gamma | Delta |\n\ntail"
		const view = createEditor(content)

		view.dispatch({
			selection: {
				anchor: content.indexOf("Alpha"),
				head: content.indexOf("Alpha") + "Alpha".length,
			},
		})

		expect(document.querySelector(".cm-table-rendered-line")).not.toBeNull()
		expect(document.querySelector(".cm-table-source-line")).toBeNull()
	})

	it("does not intercept mouse text selection that starts on cell text", () => {
		const content = "| Alpha | Beta |\n| --- | --- |\n| Gamma | Delta |\n\ntail"
		const view = createEditor(content)
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		mockTextHitRect({ left: 0, right: 48, top: 0, bottom: 20, width: 48, height: 20 })
		view.dispatch({ selection: { anchor: content.indexOf("tail") } })

		const pointerDown = new MouseEvent("pointerdown", {
			bubbles: true,
			button: 0,
			cancelable: true,
			clientX: 12,
			clientY: 10,
		})
		cells[0].dispatchEvent(pointerDown)
		cells[1].dispatchEvent(
			new MouseEvent("pointermove", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 90,
				clientY: 10,
			}),
		)

		expect(pointerDown.defaultPrevented).toBe(false)
		expect(document.querySelector(".cm-table-cell-selected")).toBeNull()
		expect(document.querySelector(".cm-table-wrapper.cm-table-selected")).toBeNull()
		expect(view.state.selection.main.anchor).toBe(content.indexOf("tail"))
	})

	it("keeps native text selection priority in dense rendered tables", () => {
		const content =
			"| Alpha text | Beta text | Gamma text | Delta text |\n| --- | --- | --- | --- |\n| Epsilon text | Zeta text | Eta text | Theta text |\n| Iota text | Kappa text | Lambda text | Mu text |\n\ntail"
		const view = createEditor(content)
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		mockTextHitRect({ left: 0, right: 90, top: 0, bottom: 20, width: 90, height: 20 })
		view.dispatch({ selection: { anchor: content.indexOf("tail") } })

		const pointerDown = new MouseEvent("pointerdown", {
			bubbles: true,
			button: 0,
			cancelable: true,
			clientX: 12,
			clientY: 10,
		})
		cells[0].dispatchEvent(pointerDown)
		cells[7].dispatchEvent(
			new MouseEvent("pointermove", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 260,
				clientY: 70,
			}),
		)
		document.dispatchEvent(
			new MouseEvent("pointerup", {
				bubbles: true,
				button: 0,
				cancelable: true,
			}),
		)

		expect(pointerDown.defaultPrevented).toBe(false)
		expect(document.querySelector(".cm-table-cell-selected")).toBeNull()
		expect(document.querySelector(".cm-table-wrapper.cm-table-selected")).toBeNull()
		expect(view.state.selection.main.anchor).toBe(content.indexOf("tail"))
	})

	it("starts visual table selection from cell padding instead of text", () => {
		createEditor("| Alpha | Beta |\n| --- | --- |\n| Gamma | Delta |\n\ntail")
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		mockTextHitRect({ left: 0, right: 48, top: 0, bottom: 20, width: 48, height: 20 })
		cells[0].dispatchEvent(
			new MouseEvent("pointerdown", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 70,
				clientY: 10,
			}),
		)
		cells[3].dispatchEvent(
			new MouseEvent("pointermove", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 120,
				clientY: 40,
			}),
		)
		document.dispatchEvent(
			new MouseEvent("pointerup", {
				bubbles: true,
				button: 0,
				cancelable: true,
			}),
		)

		expect(document.querySelector(".cm-table-wrapper.cm-table-selected")).not.toBeNull()
		expect(document.querySelectorAll(".cm-table-cell-selected")).toHaveLength(4)
	})

	it("keeps typing in the same cell after clicking past the cell text", () => {
		const content = "| Alpha | Beta |\n| --- | --- |\n| Gamma | Delta |\n\ntail"
		const view = createEditor(content)
		const firstCell = document.querySelector<HTMLElement>(
			".cm-table-cell:not(.cm-table-delimiter-cell)",
		)
		const betaPosition = content.indexOf("Beta")
		const alphaEndPosition = content.indexOf("Alpha") + "Alpha".length

		mockTextHitRect({ left: 0, right: 42, top: 0, bottom: 20, width: 42, height: 20 })
		vi.spyOn(view, "posAtCoords").mockReturnValue(betaPosition)
		firstCell?.dispatchEvent(
			new MouseEvent("pointerdown", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 70,
				clientY: 10,
			}),
		)
		typeTextThroughDom(view, "!")

		expect(view.state.selection.main.anchor).toBe(alphaEndPosition + 1)
		expect(view.state.doc.toString()).toBe(
			"| Alpha! | Beta |\n| --- | --- |\n| Gamma | Delta |\n\ntail",
		)
	})

	it("keeps the rendered table visible when text selection crosses cells", () => {
		const content = "| Alpha | Beta |\n| --- | --- |\n| Gamma | Delta |\n\ntail"
		const view = createEditor(content)

		view.dispatch({
			selection: {
				anchor: content.indexOf("Alpha"),
				head: content.indexOf("Beta") + "Beta".length,
			},
		})

		expect(document.querySelector(".cm-table-rendered-line")).not.toBeNull()
		expect(document.querySelector(".cm-table-source-line")).toBeNull()
	})

	it("does not move selection or reveal source on right click inside a rendered cell", () => {
		const content = "| Alpha | Beta |\n| --- | --- |\n| Gamma | Delta |\n\ntail"
		const view = createEditor(content)
		const alphaCell = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		).find((cell) => cell.textContent === "Alpha")

		view.dispatch({ selection: { anchor: content.indexOf("tail") } })
		alphaCell?.dispatchEvent(
			new MouseEvent("pointerdown", {
				bubbles: true,
				button: 2,
				cancelable: true,
			}),
		)
		alphaCell?.dispatchEvent(
			new MouseEvent("mousedown", {
				bubbles: true,
				button: 2,
				cancelable: true,
			}),
		)

		expect(view.state.selection.main.anchor).toBe(content.indexOf("tail"))
		expect(document.querySelector(".cm-table-rendered-line")).not.toBeNull()
		expect(document.querySelector(".cm-table-source-line")).toBeNull()
	})

	it("allows typing immediately in the first cell after Insert Table", () => {
		const view = createEditor("")

		expect(insertTable(view)).toBe(true)

		const anchor = view.state.selection.main.anchor
		typeTextThroughDom(view, "A")
		expect(view.state.doc.toString()).toBe("| A |  |\n| --- | --- |\n|  |  |")
		expect(anchor).toBe(2)
		expect(document.querySelector(".cm-table-rendered-line")).not.toBeNull()
	})

	it("enters a table from adjacent lines with ArrowDown and ArrowUp", () => {
		const content = "before\n|  |  |\n| --- | --- |\n|  |  |\nafter"
		const view = createEditor(content)

		view.dispatch({ selection: { anchor: content.indexOf("before") } })
		expect(runKey(view, "ArrowDown")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("|  |  |") + 2)
		typeTextThroughDom(view, "A")
		expect(view.state.doc.toString()).toContain("| A |  |")

		const updatedContent = view.state.doc.toString()
		view.dispatch({ selection: { anchor: updatedContent.indexOf("after") } })
		expect(runKey(view, "ArrowUp")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(updatedContent.lastIndexOf("|  |  |") + 2)
	})

	it("moves vertically inside table cells without landing on the delimiter row", () => {
		const content = "before\n| A | B |\n| --- | --- |\n| C | D |\nafter"
		const view = createEditor(content)

		view.dispatch({ selection: { anchor: content.indexOf("B") } })
		expect(runKey(view, "ArrowDown")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("D"))

		expect(runKey(view, "ArrowUp")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("B"))
	})

	it("maps table cell DOM positions to their exact source offsets", () => {
		const content = "| Alpha | Beta |\n| --- | --- |\n| Gamma | Delta |\n\ntail"
		const view = createEditor(content)
		const gammaCell = Array.from(document.querySelectorAll<HTMLElement>(".cm-table-cell")).find(
			(cell) => cell.textContent === "Gamma",
		)
		const gammaText = gammaCell?.firstChild

		expect(gammaText).not.toBeNull()
		expect(view.posAtDOM(gammaText as Node, 3)).toBe(content.indexOf("Gamma") + 3)
		expect(document.querySelector(".cm-table-row-widget")).toBeNull()
		expect(document.querySelector(".cm-table-delimiter-widget")).toBeNull()
	})

	it("keeps delimiter cells mapped while hiding only table syntax gaps", () => {
		const content = "| Left | Right |\n| :--- | ---: |\n| one | two |\n\ntail"
		const view = createEditor(content)
		const delimiterRow = document.querySelector<HTMLElement>(".cm-table-delimiter-line")
		const delimiterCells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-delimiter-cell"),
		)
		const firstDelimiterText = delimiterCells[0]?.firstChild

		expect(delimiterRow?.getAttribute("aria-hidden")).toBe("true")
		expect(delimiterCells.map((cell) => cell.textContent)).toEqual([":---", "---:"])
		expect(delimiterCells.map((cell) => cell.getAttribute("aria-hidden"))).toEqual(["true", "true"])
		expect(delimiterCells.map((cell) => cell.dataset.align)).toEqual(["left", "right"])
		expect(firstDelimiterText).not.toBeNull()
		expect(view.posAtDOM(firstDelimiterText as Node, 2)).toBe(content.indexOf(":---") + 2)
		expect(document.querySelectorAll(".cm-table-rendered-line")).toHaveLength(3)
		expect(document.querySelectorAll(".cm-line")).toHaveLength(view.state.doc.lines)
	})

	it("projects GFM table alignment onto mapped cells", () => {
		createEditor("| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |\n\ntail")
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		expect(cells.slice(0, 3).map((cell) => cell.dataset.align)).toEqual(["left", "center", "right"])
		expect(cells.slice(3).map((cell) => cell.dataset.align)).toEqual(["left", "center", "right"])
	})

	it("reflects alignment commands without losing inline table preview", () => {
		const content = "| **Name** | Value |\n| --- | --- |\n| **A** | B |\n\ntail"
		const view = createEditor(content)

		view.dispatch({ selection: { anchor: content.indexOf("Value") } })
		expect(alignTableColumnCenter(view)).toBe(true)

		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)
		expect(view.state.doc.toString()).toContain("| --- | :---: |")
		expect(cells.map((cell) => cell.dataset.align)).toEqual(["left", "center", "left", "center"])
		expect(document.querySelector(".cm-table-wrapper .cm-bold")?.textContent).toBe("Name")
	})

	it("keeps the rendered table stable after duplicate and move commands", () => {
		const content = "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n\ntail"
		const duplicateView = createEditor(content)
		duplicateView.dispatch({ selection: { anchor: content.indexOf("B") } })

		expect(duplicateTableColumn(duplicateView)).toBe(true)
		expect(duplicateView.state.doc.toString()).toBe(
			"| A | B | B | C |\n| --- | --- | --- | --- |\n| 1 | 2 | 2 | 3 |\n\ntail",
		)
		expect(document.querySelectorAll(".cm-table-rendered-line")).toHaveLength(3)
		expect(document.querySelectorAll(".cm-table-cell:not(.cm-table-delimiter-cell)")).toHaveLength(
			8,
		)

		duplicateView.destroy()
		editorViews.splice(editorViews.indexOf(duplicateView), 1)
		document.body.replaceChildren()

		const moveView = createEditor(content)
		moveView.dispatch({ selection: { anchor: content.indexOf("B") } })

		expect(moveTableColumnRight(moveView)).toBe(true)
		expect(moveView.state.doc.toString()).toBe(
			"| A | C | B |\n| --- | --- | --- |\n| 1 | 3 | 2 |\n\ntail",
		)
		expect(document.querySelectorAll(".cm-table-rendered-line")).toHaveLength(3)
		expect(document.querySelectorAll(".cm-table-cell:not(.cm-table-delimiter-cell)")).toHaveLength(
			6,
		)
	})

	it("keeps drag handles hidden until the pointer reaches an edge zone", () => {
		const view = createEditor("| A | B |\n| --- | --- |\n| C | D |\n\ntail")
		const wrapper = document.querySelector<HTMLElement>(".cm-table-wrapper")
		const row = document.querySelector<HTMLElement>(".cm-table-rendered-line")
		const firstCell = document.querySelector<HTMLElement>(
			".cm-table-cell:not(.cm-table-delimiter-cell)",
		)
		const rowHandle = document.querySelector<HTMLButtonElement>("[aria-label='Drag row']")
		const columnHandle = document.querySelector<HTMLButtonElement>("[aria-label='Drag column']")

		expect(wrapper).not.toBeNull()
		expect(row).not.toBeNull()
		expect(firstCell).not.toBeNull()
		mockRect(view.dom, { left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 })
		mockRect(wrapper!, { left: 100, top: 100, right: 260, bottom: 180, width: 160, height: 80 })
		mockRect(row!, { left: 100, top: 100, right: 260, bottom: 140, width: 160, height: 40 })
		mockRect(firstCell!, { left: 100, top: 100, right: 180, bottom: 140, width: 80, height: 40 })

		hoverTableCell(firstCell, { x: 150, y: 130 })

		expect(rowHandle?.hidden).toBe(true)
		expect(columnHandle?.hidden).toBe(true)

		hoverTableCell(firstCell, { x: 104, y: 104 })

		expect(rowHandle?.hidden).toBe(true)
		expect(columnHandle?.hidden).toBe(false)
	})

	it("keeps the row handle visible while moving from the cell into the handle gutter", () => {
		const view = createEditor("| A | B |\n| --- | --- |\n| C | D |\n\ntail")
		const wrapper = document.querySelector<HTMLElement>(".cm-table-wrapper")
		const bodyRow = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-rendered-line"),
		).find((row) => row.textContent?.includes("C"))
		const bodyCell = Array.from(
			bodyRow?.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)") ?? [],
		)[0]
		const rowHandle = document.querySelector<HTMLButtonElement>("[aria-label='Drag row']")
		const columnHandle = document.querySelector<HTMLButtonElement>("[aria-label='Drag column']")

		expect(wrapper).not.toBeNull()
		expect(bodyRow).not.toBeNull()
		expect(bodyCell).not.toBeNull()
		mockRect(view.dom, { left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 })
		mockRect(wrapper!, { left: 100, top: 100, right: 260, bottom: 220, width: 160, height: 120 })
		mockRect(bodyRow!, { left: 100, top: 160, right: 260, bottom: 200, width: 160, height: 40 })
		mockRect(bodyCell, { left: 100, top: 160, right: 180, bottom: 200, width: 80, height: 40 })

		hoverTableCell(bodyCell, { x: 104, y: 180 })
		expect(rowHandle?.hidden).toBe(false)

		movePointer(view.dom, { x: 82, y: 180 })

		expect(rowHandle?.hidden).toBe(false)
		expect(columnHandle?.hidden).toBe(true)

		movePointer(view.dom, { x: 360, y: 260 })

		expect(rowHandle?.hidden).toBe(true)
	})

	it("adds a column at the right edge from the plus affordance", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |\n\ntail"
		const view = createEditor(content)
		const wrapper = document.querySelector<HTMLElement>(".cm-table-wrapper")
		const headerRow = document.querySelector<HTMLElement>(".cm-table-rendered-line")
		const cells = Array.from(
			headerRow?.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)") ??
				[],
		)
		const addColumn = document.querySelector<HTMLButtonElement>(
			"[aria-label='Add column to the right']",
		)

		expect(wrapper).not.toBeNull()
		expect(headerRow).not.toBeNull()
		expect(cells).toHaveLength(2)
		mockRect(view.dom, { left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 })
		mockRect(wrapper!, { left: 100, top: 100, right: 260, bottom: 180, width: 160, height: 80 })
		mockRect(headerRow!, { left: 100, top: 100, right: 260, bottom: 140, width: 160, height: 40 })
		mockRect(cells[0], { left: 100, top: 100, right: 180, bottom: 140, width: 80, height: 40 })
		mockRect(cells[1], { left: 180, top: 100, right: 260, bottom: 140, width: 80, height: 40 })

		movePointer(view.dom, { x: 264, y: 120 })
		expect(addColumn?.hidden).toBe(false)
		expect(addColumn?.textContent).toBe("+")

		clickElement(addColumn)

		expect(view.state.doc.toString()).toBe(
			"| A | B |  |\n| --- | --- | --- |\n| C | D |  |\n\ntail",
		)
	})

	it("adds a row at the bottom edge from the plus affordance", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |\n\ntail"
		const view = createEditor(content)
		const wrapper = document.querySelector<HTMLElement>(".cm-table-wrapper")
		const rows = Array.from(document.querySelectorAll<HTMLElement>(".cm-table-rendered-line"))
		const bodyRow = rows.find((row) => row.textContent?.includes("C"))
		const cells = Array.from(
			bodyRow?.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)") ?? [],
		)
		const addRow = document.querySelector<HTMLButtonElement>("[aria-label='Add row below']")

		expect(wrapper).not.toBeNull()
		expect(bodyRow).not.toBeNull()
		expect(cells).toHaveLength(2)
		mockRect(view.dom, { left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 })
		mockRect(wrapper!, { left: 100, top: 100, right: 260, bottom: 180, width: 160, height: 80 })
		mockRect(bodyRow!, { left: 100, top: 140, right: 260, bottom: 180, width: 160, height: 40 })
		mockRect(cells[0], { left: 100, top: 140, right: 180, bottom: 180, width: 80, height: 40 })
		mockRect(cells[1], { left: 180, top: 140, right: 260, bottom: 180, width: 80, height: 40 })

		movePointer(view.dom, { x: 220, y: 184 })
		expect(addRow?.hidden).toBe(false)

		clickElement(addRow)

		expect(view.state.doc.toString()).toBe("| A | B |\n| --- | --- |\n| C | D |\n|  |  |\n\ntail")
	})

	it("does not show plus affordances while a visual table selection is active", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |\n\ntail"
		const view = createEditor(content)
		const wrapper = document.querySelector<HTMLElement>(".cm-table-wrapper")
		const row = document.querySelector<HTMLElement>(".cm-table-rendered-line")
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)
		const addColumn = document.querySelector<HTMLButtonElement>(
			"[aria-label='Add column to the right']",
		)

		mockRect(view.dom, { left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 })
		mockRect(wrapper!, { left: 100, top: 100, right: 260, bottom: 180, width: 160, height: 80 })
		mockRect(row!, { left: 100, top: 100, right: 260, bottom: 140, width: 160, height: 40 })

		view.dispatch({ selection: { anchor: content.indexOf("A") } })
		shiftClickTableCell(cells[3])
		movePointer(view.dom, { x: 264, y: 120 })

		expect(addColumn?.hidden).toBe(true)
	})

	it("drags a body row handle to reorder rows without opening a menu", () => {
		const content = "| H | V |\n| --- | --- |\n| one | 1 |\n| two | 2 |\n| three | 3 |\n\ntail"
		const view = createEditor(content)
		const wrapper = document.querySelector<HTMLElement>(".cm-table-wrapper")
		const rows = Array.from(document.querySelectorAll<HTMLElement>(".cm-table-rendered-line"))
		const oneRow = rows.find((row) => row.textContent?.includes("one"))
		const twoRow = rows.find((row) => row.textContent?.includes("two"))
		const threeRow = rows.find((row) => row.textContent?.includes("three"))
		const oneCell = oneRow?.querySelector<HTMLElement>(
			".cm-table-cell:not(.cm-table-delimiter-cell)",
		)
		const twoCell = twoRow?.querySelector<HTMLElement>(
			".cm-table-cell:not(.cm-table-delimiter-cell)",
		)
		const threeCell = threeRow?.querySelector<HTMLElement>(
			".cm-table-cell:not(.cm-table-delimiter-cell)",
		)
		const rowHandle = document.querySelector<HTMLButtonElement>("[aria-label='Drag row']")

		expect(wrapper).not.toBeNull()
		expect(oneRow).not.toBeNull()
		expect(twoRow).not.toBeNull()
		expect(threeRow).not.toBeNull()
		expect(oneCell).not.toBeNull()
		expect(twoCell).not.toBeNull()
		expect(threeCell).not.toBeNull()
		mockRect(view.dom, { left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 })
		mockRect(wrapper!, { left: 100, top: 100, right: 260, bottom: 260, width: 160, height: 160 })
		mockRect(oneRow!, { left: 100, top: 140, right: 260, bottom: 180, width: 160, height: 40 })
		mockRect(twoRow!, { left: 100, top: 180, right: 260, bottom: 220, width: 160, height: 40 })
		mockRect(threeRow!, { left: 100, top: 220, right: 260, bottom: 260, width: 160, height: 40 })
		mockRect(oneCell!, { left: 100, top: 140, right: 180, bottom: 180, width: 80, height: 40 })
		mockRect(twoCell!, { left: 100, top: 180, right: 180, bottom: 220, width: 80, height: 40 })
		mockRect(threeCell!, { left: 100, top: 220, right: 180, bottom: 260, width: 80, height: 40 })

		hoverTableCell(oneCell!, { x: 104, y: 160 })
		expect(rowHandle?.hidden).toBe(false)

		rowHandle?.dispatchEvent(
			new MouseEvent("pointerdown", {
				bubbles: true,
				button: 0,
				cancelable: true,
			}),
		)
		document.dispatchEvent(
			new MouseEvent("pointermove", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 104,
				clientY: 240,
			}),
		)

		expect(document.querySelector<HTMLElement>(".cm-table-affordance-drag-preview")?.hidden).toBe(
			false,
		)
		expect(
			document
				.querySelector<HTMLElement>(".cm-table-affordance-drag-preview")
				?.classList.contains("is-row"),
		).toBe(true)
		expect(threeRow?.classList.contains("cm-table-drop-after")).toBe(true)

		document.dispatchEvent(
			new MouseEvent("pointerup", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 104,
				clientY: 240,
			}),
		)

		expect(document.querySelector(".cm-table-affordance-menu")).toBeNull()
		expect(view.state.doc.toString()).toBe(
			"| H | V |\n| --- | --- |\n| two | 2 |\n| three | 3 |\n| one | 1 |\n\ntail",
		)
	})

	it("does not show a row drag handle for the header row", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |\n\ntail"
		const view = createEditor(content)
		const wrapper = document.querySelector<HTMLElement>(".cm-table-wrapper")
		const headerRow = document.querySelector<HTMLElement>(".cm-table-rendered-line")
		const headerCell = headerRow?.querySelector<HTMLElement>(
			".cm-table-cell:not(.cm-table-delimiter-cell)",
		)
		const rowHandle = document.querySelector<HTMLButtonElement>("[aria-label='Drag row']")

		mockRect(view.dom, { left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 })
		mockRect(wrapper!, { left: 100, top: 100, right: 260, bottom: 180, width: 160, height: 80 })
		mockRect(headerRow!, { left: 100, top: 100, right: 260, bottom: 140, width: 160, height: 40 })
		mockRect(headerCell!, { left: 100, top: 100, right: 180, bottom: 140, width: 80, height: 40 })

		hoverTableCell(headerCell!, { x: 104, y: 120 })

		expect(rowHandle?.hidden).toBe(true)
	})

	it("drags a column handle to reorder columns without opening a menu", () => {
		const content = "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n\ntail"
		const view = createEditor(content)
		const wrapper = document.querySelector<HTMLElement>(".cm-table-wrapper")
		const headerRow = document.querySelector<HTMLElement>(".cm-table-rendered-line")
		const cells = Array.from(
			headerRow?.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)") ??
				[],
		)
		const columnHandle = document.querySelector<HTMLButtonElement>("[aria-label='Drag column']")

		expect(wrapper).not.toBeNull()
		expect(headerRow).not.toBeNull()
		expect(cells).toHaveLength(3)
		mockRect(view.dom, { left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 })
		mockRect(wrapper!, { left: 100, top: 100, right: 340, bottom: 180, width: 240, height: 80 })
		mockRect(headerRow!, { left: 100, top: 100, right: 340, bottom: 140, width: 240, height: 40 })
		mockRect(cells[0], { left: 100, top: 100, right: 180, bottom: 140, width: 80, height: 40 })
		mockRect(cells[1], { left: 180, top: 100, right: 260, bottom: 140, width: 80, height: 40 })
		mockRect(cells[2], { left: 260, top: 100, right: 340, bottom: 140, width: 80, height: 40 })

		hoverTableCell(cells[1], { x: 220, y: 104 })
		expect(columnHandle?.hidden).toBe(false)

		columnHandle?.dispatchEvent(
			new MouseEvent("pointerdown", {
				bubbles: true,
				button: 0,
				cancelable: true,
			}),
		)
		document.dispatchEvent(
			new MouseEvent("pointermove", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 300,
				clientY: 104,
			}),
		)

		expect(document.querySelector<HTMLElement>(".cm-table-affordance-drag-preview")?.hidden).toBe(
			false,
		)
		expect(
			document
				.querySelector<HTMLElement>(".cm-table-affordance-drag-preview")
				?.classList.contains("is-column"),
		).toBe(true)
		expect(cells[2].classList.contains("cm-table-drop-after")).toBe(true)

		document.dispatchEvent(
			new MouseEvent("pointerup", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 300,
				clientY: 104,
			}),
		)

		expect(document.querySelector(".cm-table-affordance-menu")).toBeNull()
		expect(view.state.doc.toString()).toBe(
			"| A | C | B |\n| --- | --- | --- |\n| 1 | 3 | 2 |\n\ntail",
		)
	})

	it("resizes one rendered column without changing Markdown", () => {
		const content = "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n\ntail"
		const view = createEditor(content)
		const wrapper = document.querySelector<HTMLElement>(".cm-table-wrapper")
		const headerRow = document.querySelector<HTMLElement>(".cm-table-rendered-line")
		const rows = Array.from(document.querySelectorAll<HTMLElement>(".cm-table-rendered-line"))
		const headerCells = Array.from(
			headerRow?.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)") ??
				[],
		)
		const bodyCells = Array.from(
			rows[2]?.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)") ?? [],
		)
		const resizeHandle = document.querySelector<HTMLButtonElement>("[aria-label='Resize column']")

		expect(wrapper).not.toBeNull()
		expect(headerRow).not.toBeNull()
		expect(headerCells).toHaveLength(3)
		expect(bodyCells).toHaveLength(3)
		mockRect(view.dom, { left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 })
		mockRect(wrapper!, { left: 100, top: 100, right: 340, bottom: 180, width: 240, height: 80 })
		mockRect(headerRow!, { left: 100, top: 100, right: 340, bottom: 140, width: 240, height: 40 })
		mockRect(headerCells[0], { left: 100, top: 100, right: 180, bottom: 140, width: 80 })
		mockRect(headerCells[1], { left: 180, top: 100, right: 260, bottom: 140, width: 80 })
		mockRect(headerCells[2], { left: 260, top: 100, right: 340, bottom: 140, width: 80 })

		movePointer(headerCells[0], { x: 180, y: 120 })

		expect(resizeHandle?.hidden).toBe(false)
		expect(resizeHandle?.style.transform).toContain("175px")

		resizeHandle?.dispatchEvent(
			new MouseEvent("pointerdown", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 180,
			}),
		)
		document.dispatchEvent(
			new MouseEvent("pointermove", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 240,
			}),
		)
		document.dispatchEvent(
			new MouseEvent("pointerup", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 240,
			}),
		)

		const firstColumnCells = [headerCells[0], bodyCells[0]]
		expect(firstColumnCells.every((cell) => cell.classList.contains("cm-table-cell-resized"))).toBe(
			true,
		)
		expect(
			firstColumnCells.every(
				(cell) => cell.style.getPropertyValue("--cm-table-column-width") === "140px",
			),
		).toBe(true)
		expect(headerCells[1].style.getPropertyValue("--cm-table-column-width")).toBe("")
		expect(view.state.doc.toString()).toBe(content)
	})

	it("respects resize bounds and resets a column on double click", () => {
		const content = "| A | B |\n| --- | --- |\n| 1 | 2 |\n\ntail"
		const view = createEditor(content)
		const wrapper = document.querySelector<HTMLElement>(".cm-table-wrapper")
		const headerRow = document.querySelector<HTMLElement>(".cm-table-rendered-line")
		const headerCells = Array.from(
			headerRow?.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)") ??
				[],
		)
		const resizeHandle = document.querySelector<HTMLButtonElement>("[aria-label='Resize column']")

		mockRect(view.dom, { left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 })
		mockRect(wrapper!, { left: 100, top: 100, right: 260, bottom: 180, width: 160, height: 80 })
		mockRect(headerRow!, { left: 100, top: 100, right: 260, bottom: 140, width: 160, height: 40 })
		mockRect(headerCells[0], { left: 100, top: 100, right: 180, bottom: 140, width: 80 })
		mockRect(headerCells[1], { left: 180, top: 100, right: 260, bottom: 140, width: 80 })

		movePointer(headerCells[0], { x: 180, y: 120 })
		resizeHandle?.dispatchEvent(
			new MouseEvent("pointerdown", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 180,
			}),
		)
		document.dispatchEvent(
			new MouseEvent("pointermove", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 2000,
			}),
		)
		document.dispatchEvent(
			new MouseEvent("pointerup", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 2000,
			}),
		)

		expect(headerCells[0].style.getPropertyValue("--cm-table-column-width")).toBe("720px")

		resizeHandle?.dispatchEvent(
			new MouseEvent("dblclick", {
				bubbles: true,
				button: 0,
				cancelable: true,
			}),
		)

		expect(headerCells[0].style.getPropertyValue("--cm-table-column-width")).toBe("")
		expect(headerCells[0].classList.contains("cm-table-cell-resized")).toBe(false)
		expect(view.state.doc.toString()).toBe(content)
	})

	it("cancels an active resize with Escape", () => {
		const content = "| A | B |\n| --- | --- |\n| 1 | 2 |\n\ntail"
		createEditor(content)
		const wrapper = document.querySelector<HTMLElement>(".cm-table-wrapper")
		const headerRow = document.querySelector<HTMLElement>(".cm-table-rendered-line")
		const headerCells = Array.from(
			headerRow?.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)") ??
				[],
		)
		const resizeHandle = document.querySelector<HTMLButtonElement>("[aria-label='Resize column']")

		mockRect(document.querySelector(".cm-editor")!, {
			left: 0,
			top: 0,
			right: 500,
			bottom: 500,
			width: 500,
			height: 500,
		})
		mockRect(wrapper!, { left: 100, top: 100, right: 260, bottom: 180, width: 160, height: 80 })
		mockRect(headerRow!, { left: 100, top: 100, right: 260, bottom: 140, width: 160, height: 40 })
		mockRect(headerCells[0], { left: 100, top: 100, right: 180, bottom: 140, width: 80 })
		mockRect(headerCells[1], { left: 180, top: 100, right: 260, bottom: 140, width: 80 })

		movePointer(headerCells[0], { x: 180, y: 120 })
		resizeHandle?.dispatchEvent(
			new MouseEvent("pointerdown", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 180,
			}),
		)
		document.dispatchEvent(
			new MouseEvent("pointermove", {
				bubbles: true,
				button: 0,
				cancelable: true,
				clientX: 240,
			}),
		)
		document.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				cancelable: true,
				key: "Escape",
			}),
		)

		expect(headerCells[0].style.getPropertyValue("--cm-table-column-width")).toBe("")
		expect(headerCells[0].classList.contains("cm-table-cell-resized")).toBe(false)
	})

	it("does not show table affordances while a visual table selection is active", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |\n\ntail"
		createEditor(content)
		const cells = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-table-cell:not(.cm-table-delimiter-cell)"),
		)

		dragVisualTableSelection(cells[0], cells[3])

		expect(document.querySelector(".cm-table-cell")).not.toBeNull()
		expect(document.querySelector(".cm-table-source-line")).toBeNull()
		expect(document.querySelector<HTMLButtonElement>("[aria-label='Drag row']")?.hidden).toBe(true)
		expect(document.querySelector<HTMLButtonElement>("[aria-label='Drag column']")?.hidden).toBe(
			true,
		)
		expect(
			document.querySelector<HTMLButtonElement>("[aria-label='Add column to the right']")?.hidden,
		).toBe(true)
	})

	it("keeps normal cell input working after showing and hiding affordances", () => {
		const view = createEditor("|  | B |\n| --- | --- |\n| C | D |\n\ntail")
		const firstCell = document.querySelector(".cm-table-cell-empty")

		hoverTableCell(firstCell)
		document.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				cancelable: true,
				key: "Escape",
			}),
		)
		clickTableCell(firstCell)
		typeTextThroughDom(view, "Z")

		expect(view.state.doc.toString()).toBe("| Z | B |\n| --- | --- |\n| C | D |\n\ntail")
	})

	it("marks header cells for subtle table hierarchy without extra active cell marks", () => {
		const content = "| Head | Other |\n| --- | --- |\n| body | text |\n\ntail"
		const view = createEditor(content)

		view.dispatch({ selection: { anchor: content.indexOf("body") } })

		const headerCell = document.querySelector<HTMLElement>(
			".cm-table-header-line .cm-table-cell:not(.cm-table-delimiter-cell)",
		)
		const activeCell = document.querySelector<HTMLElement>(".cm-table-cell-active")

		expect(headerCell?.textContent).toBe("Head")
		expect(activeCell).toBeNull()
	})

	it("reveals blockquote markers from any cursor position in the block", () => {
		const content = "> quoted\n\ntail"
		const view = createEditor(content)

		expect(document.querySelector(".cm-blockquote")?.textContent).not.toContain(">")
		view.dispatch({ selection: { anchor: content.indexOf("quoted") + 2 } })
		expect(document.querySelector(".cm-blockquote")?.textContent).toContain(">")
	})

	it("shows horizontal rule source when the cursor enters the line", () => {
		const content = "---\n\ntail"
		const view = createEditor(content)

		expect(document.querySelector(".cm-horizontal-rule-line")).not.toBeNull()
		expect(document.querySelector(".cm-hr-widget")).toBeNull()
		expect(document.querySelector(".cm-content")?.textContent).not.toContain("---")
		view.dispatch({ selection: { anchor: 1 } })
		expect(document.querySelector(".cm-horizontal-rule-line")).toBeNull()
		expect(document.querySelector(".cm-content")?.textContent).toContain("---")
		view.dispatch({ selection: { anchor: content.length } })
		expect(document.querySelector(".cm-horizontal-rule-line")).not.toBeNull()
		expect(document.querySelectorAll(".cm-line")).toHaveLength(view.state.doc.lines)
	})

	it("reveals fenced code markers only while the cursor is inside the block", () => {
		const content = "```ts\nconst value = 1\n```\n\ntail"
		const view = createEditor(content)

		expect(document.querySelector(".cm-content")?.textContent).not.toContain("```ts")
		view.dispatch({ selection: { anchor: content.indexOf("const") } })
		expect(document.querySelector(".cm-content")?.textContent).toContain("```ts")
		view.dispatch({ selection: { anchor: content.length } })
		expect(document.querySelector(".cm-content")?.textContent).not.toContain("```ts")
		expect(document.querySelector(".cm-codeblock-language")).not.toBeNull()
	})
})
