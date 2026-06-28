import { markdown } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { livePreviewExtension } from "../livePreview"
import { loadEditorRuntime } from "../runtime"

const editorViews: EditorView[] = []
let editorRuntime: Awaited<ReturnType<typeof loadEditorRuntime>>

beforeAll(async () => {
	editorRuntime = await loadEditorRuntime()
})

afterEach(() => {
	for (const view of editorViews.splice(0)) view.destroy()
	document.body.replaceChildren()
	vi.restoreAllMocks()
})

function createCodeBlockEditor(): EditorView {
	const content = "```ts\nconst first = 1\n```\n\n```ts\nconst second = 2\n```\n\ntail"
	const parent = document.createElement("div")
	document.body.appendChild(parent)
	const view = new EditorView({
		state: EditorState.create({
			doc: content,
			selection: { anchor: content.length },
			extensions: [markdown(), livePreviewExtension(editorRuntime)],
		}),
		parent,
	})
	editorViews.push(view)
	return view
}

describe("code block live preview", () => {
	it("shows the language badge until a code block is hovered", () => {
		createCodeBlockEditor()
		expect(document.querySelectorAll(".cm-codeblock-copy")).toHaveLength(0)
		const languageBadges = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-codeblock-language"),
		)

		expect(languageBadges).toHaveLength(2)
		expect(languageBadges.map((badge) => badge.textContent)).toEqual(["ts", "ts"])
		expect(languageBadges[0].closest(".cm-codeblock-chrome")).not.toBeNull()
	})

	it("shows controls only for the hovered block", () => {
		createCodeBlockEditor()

		const codeBlockLines = document.querySelectorAll<HTMLElement>(".cm-codeblock-line")
		const secondBlockId = codeBlockLines[3].dataset.codeblockId

		codeBlockLines[3].dispatchEvent(new Event("pointerover", { bubbles: true }))

		const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".cm-codeblock-copy"))
		const languageBadges = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-codeblock-language"),
		)

		expect(buttons).toHaveLength(1)
		expect(buttons[0].dataset.controlsVisible).toBe("true")
		expect(buttons[0].dataset.codeblockId).toBe(secondBlockId)
		expect(buttons[0].closest(".cm-codeblock-chrome")).not.toBeNull()
		expect(languageBadges).toHaveLength(1)
	})

	it("copies on the first click without moving the editor selection", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined)
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		})
		const view = createCodeBlockEditor()
		const codeBlockLines = document.querySelectorAll<HTMLElement>(".cm-codeblock-line")
		codeBlockLines[3].dispatchEvent(new Event("pointerover", { bubbles: true }))
		const button = Array.from(
			document.querySelectorAll<HTMLButtonElement>(".cm-codeblock-copy"),
		).find((candidate) => candidate.dataset.controlsVisible === "true")
		const selectionBefore = view.state.selection.main.anchor

		button?.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }))
		button?.click()
		await Promise.resolve()

		expect(writeText).toHaveBeenCalledTimes(1)
		expect(writeText).toHaveBeenCalledWith("const second = 2")
		expect(view.state.selection.main.anchor).toBe(selectionBefore)
		expect(button?.textContent).toBe("Copied!")
	})

	it("does not show copy controls while editing the opening fence", () => {
		const view = createCodeBlockEditor()
		const codeBlockLines = document.querySelectorAll<HTMLElement>(".cm-codeblock-line")
		const firstFenceLanguagePosition = view.state.doc.toString().indexOf("ts")

		view.dispatch({ selection: { anchor: firstFenceLanguagePosition } })
		codeBlockLines[0].dispatchEvent(new Event("pointerover", { bubbles: true }))

		expect(document.querySelectorAll(".cm-codeblock-copy")).toHaveLength(0)
		expect(document.querySelectorAll(".cm-codeblock-language")).toHaveLength(1)
	})

	it("keeps the block background from covering selected code", () => {
		const view = createCodeBlockEditor()
		const content = view.state.doc.toString()
		const selectionStart = content.indexOf("const first")
		const selectionEnd = content.indexOf("tail")

		view.dispatch({ selection: { anchor: selectionStart, head: selectionEnd } })

		const selectedCodeBlock = document.querySelector(".cm-codeblock-wrapper.is-selection-overlap")
		expect(selectedCodeBlock).not.toBeNull()
	})
})
