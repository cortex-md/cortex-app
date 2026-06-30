import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { baseExtensions, DEFAULT_EDITOR_CONFIG } from "../extensions"
import { insertInlineMath, insertMathBlock } from "../markdownCommands"
import { markdownFormatCommandDefinitions } from "../markdownFormatCommands"
import { loadEditorRuntime } from "../runtime"
import type { EditorRuntimeView } from "../types"

const editorViews: EditorRuntimeView[] = []
let editorRuntime: Awaited<ReturnType<typeof loadEditorRuntime>>

beforeAll(async () => {
	editorRuntime = await loadEditorRuntime()
})

afterEach(() => {
	for (const view of editorViews.splice(0)) view.destroy()
	document.body.replaceChildren()
})

function createEditor(content: string, anchor = content.length, head = anchor): EditorRuntimeView {
	const parent = document.createElement("div")
	document.body.appendChild(parent)
	const view = new editorRuntime.view.EditorView({
		state: editorRuntime.state.EditorState.create({
			doc: content,
			selection: { anchor, head },
			extensions: [...baseExtensions(editorRuntime, DEFAULT_EDITOR_CONFIG, { livePreview: false })],
		}),
		parent,
	}) as EditorRuntimeView
	editorViews.push(view)
	return view
}

describe("Markdown math commands", () => {
	it("inserts an inline formula shell at the cursor", () => {
		const view = createEditor("Energy ")

		expect(insertInlineMath(view)).toBe(true)

		expect(view.state.doc.toString()).toBe("Energy $$")
		expect(view.state.selection.main.anchor).toBe("Energy $".length)
	})

	it("wraps selected single-line text as an inline formula", () => {
		const view = createEditor("E = mc^2", 0, "E = mc^2".length)

		expect(insertInlineMath(view)).toBe(true)

		expect(view.state.doc.toString()).toBe("$E = mc^2$")
		expect(view.state.selection.main.from).toBe(0)
		expect(view.state.selection.main.to).toBe("$E = mc^2$".length)
	})

	it("turns selected multiline text into a formula block", () => {
		const content = "a\nb"
		const view = createEditor(content, 0, content.length)

		expect(insertInlineMath(view)).toBe(true)

		expect(view.state.doc.toString()).toBe("$$\na\nb\n$$")
		expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
			content,
		)
	})

	it("inserts a formula block shell at the cursor", () => {
		const view = createEditor("Before")

		expect(insertMathBlock(view)).toBe(true)

		expect(view.state.doc.toString()).toBe("Before$$\n\n$$")
		expect(view.state.selection.main.anchor).toBe("Before$$\n".length)
	})

	it("wraps selected text in a formula block", () => {
		const content = "x^2 + y^2 = z^2"
		const view = createEditor(content, 0, content.length)

		expect(insertMathBlock(view)).toBe(true)

		expect(view.state.doc.toString()).toBe("$$\nx^2 + y^2 = z^2\n$$")
		expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
			content,
		)
	})

	it("registers formula commands without default hotkeys", () => {
		const inlineMath = markdownFormatCommandDefinitions.find(
			(definition) => definition.id === "format.inline-math",
		)
		const mathBlock = markdownFormatCommandDefinitions.find(
			(definition) => definition.id === "format.math-block",
		)

		expect(inlineMath).toMatchObject({
			label: "Inline Formula",
			category: "Format",
			aliases: expect.arrayContaining(["math", "formula", "equation", "latex", "inline-math"]),
		})
		expect(mathBlock).toMatchObject({
			label: "Formula Block",
			category: "Format",
			aliases: expect.arrayContaining(["math block", "block math", "display math", "latex block"]),
		})
		expect(inlineMath?.hotkey).toBeUndefined()
		expect(mathBlock?.hotkey).toBeUndefined()
	})
})
