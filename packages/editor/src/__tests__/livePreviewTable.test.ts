import { markdown } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { GFM } from "@lezer/markdown"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { livePreviewExtension } from "../livePreview"
import { insertTable } from "../markdownCommands"
import { defaultMarkdownKeymapExtension } from "../markdownKeymap"
import { loadEditorRuntime } from "../runtime"
import { tableAffordancesExtension } from "../tableAffordances"
import { duplicateTableColumn, moveTableColumnRight, tableEditingExtension } from "../tableEditing"
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

describe("GFM inline rendering", () => {
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

	it("allows typing immediately in the first cell after Insert Table", () => {
		const view = createEditor("")

		expect(insertTable(view)).toBe(true)

		const anchor = view.state.selection.main.anchor
		typeTextThroughDom(view, "A")
		expect(view.state.doc.toString()).toBe("| A |  |\n| --- | --- |\n|  |  |")
		expect(anchor).toBe(2)
		expect(document.querySelector(".cm-table-rendered-line")).not.toBeNull()
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
})
