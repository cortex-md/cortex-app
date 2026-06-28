import { markdown } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { GFM } from "@lezer/markdown"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
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
})

function createEditor(content: string): EditorView {
	const parent = document.createElement("div")
	document.body.appendChild(parent)
	const view = new EditorView({
		state: EditorState.create({
			doc: content,
			selection: { anchor: content.length },
			extensions: [markdown({ extensions: GFM }), livePreviewExtension(editorRuntime)],
		}),
		parent,
	})
	editorViews.push(view)
	return view
}

describe("live preview lists", () => {
	it("projects unordered and ordered markers", () => {
		createEditor("- alpha\n\n1. first\n2. second\n\ntail")

		expect(
			Array.from(document.querySelectorAll(".cm-list-marker")).map((marker) => marker.textContent),
		).toEqual(["•", "1.", "2."])
	})

	it("reveals and restores the raw marker for the active list item line", () => {
		const content = "- alpha\n- beta\n\ntail"
		const view = createEditor(content)

		expect(document.querySelectorAll(".cm-list-marker")).toHaveLength(2)
		view.dispatch({ selection: { anchor: content.indexOf("alpha") + 2 } })
		expect(document.querySelectorAll(".cm-list-marker")).toHaveLength(1)
		expect(document.querySelector(".cm-content")?.textContent).toContain("- alpha")
		expect(view.state.doc.toString()).toBe(content)

		view.dispatch({ selection: { anchor: content.length } })
		expect(document.querySelectorAll(".cm-list-marker")).toHaveLength(2)
		expect(view.state.doc.toString()).toBe(content)
	})

	it("keeps nested bullets and task checkboxes projected", () => {
		const content = "- parent\n  - child\n    - grandchild\n- [ ] task\n\ntail"
		const view = createEditor(content)

		expect(document.querySelectorAll(".cm-list-marker")).toHaveLength(4)
		const checkbox = document.querySelector<HTMLElement>(".cm-checkbox.markdown-task-checkbox")
		expect(checkbox).not.toBeNull()
		expect(checkbox?.getAttribute("role")).toBe("checkbox")
		expect(checkbox?.getAttribute("aria-checked")).toBe("false")
		expect(checkbox?.querySelector("svg .markdown-task-checkbox-check")).not.toBeNull()

		view.dispatch({ selection: { anchor: content.indexOf("task") + 1 } })
		expect(document.querySelectorAll(".cm-list-marker")).toHaveLength(3)
		expect(document.querySelector(".cm-checkbox")).not.toBeNull()
		expect(document.querySelector(".cm-content")?.textContent).toContain("- ")
	})

	it("toggles task checkbox widgets through the Markdown source", () => {
		const content = "- [ ] task\n- [x] done\n\ntail"
		const view = createEditor(content)
		const checkboxes = Array.from(
			document.querySelectorAll<HTMLElement>(".cm-checkbox.markdown-task-checkbox"),
		)

		expect(checkboxes).toHaveLength(2)
		expect(checkboxes[0].getAttribute("aria-checked")).toBe("false")
		expect(checkboxes[1].getAttribute("aria-checked")).toBe("true")

		checkboxes[0].dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }))

		expect(view.state.doc.toString()).toBe("- [x] task\n- [x] done\n\ntail")
	})
})
