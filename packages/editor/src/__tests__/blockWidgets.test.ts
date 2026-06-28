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

function createBlockWidgetEditor(content: string): EditorView {
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

describe("block live preview projections", () => {
	it("renders tables and expanded callouts on source lines", () => {
		const content = `| Name | Style |
| --- | --- |
| **Bold** | *Italic* |

> [!warning] **Important** and *urgent*
>
> Body with *emphasis*.

tail`

		expect(() => createBlockWidgetEditor(content)).not.toThrow()
		expect(document.querySelector(".cm-table-wrapper .cm-bold")?.textContent).toBe("Bold")
		expect(document.querySelector(".cm-table-wrapper .cm-italic")?.textContent).toBe("Italic")
		expect(document.querySelectorAll(".cm-table-rendered-line")).toHaveLength(3)
		expect(document.querySelectorAll(".cm-table-cell:not(.cm-table-delimiter-cell)")).toHaveLength(
			4,
		)
		expect(document.querySelectorAll(".cm-table-delimiter-cell")).toHaveLength(2)
		expect(document.querySelector(".cm-table-row-widget")).toBeNull()
		expect(document.querySelectorAll(".cm-callout-line").length).toBeGreaterThan(1)
		expect(
			Array.from(document.querySelectorAll(".cm-bold")).some(
				(element) => element.textContent === "Important",
			),
		).toBe(true)
		expect(
			Array.from(document.querySelectorAll(".cm-italic")).some(
				(element) => element.textContent === "urgent",
			),
		).toBe(true)
	})

	it("toggles a collapsed callout without moving the editor selection", () => {
		const content = "> [!tip]- Folded\n> Hidden\n\ntail"
		const view = createBlockWidgetEditor(content)
		const selectionBefore = view.state.selection.main.anchor
		const callout = document.querySelector(".cm-callout-wrapper")
		const toggle = callout?.querySelector<HTMLButtonElement>("[data-callout-toggle]")

		expect(callout?.classList.contains("is-collapsed")).toBe(true)
		toggle?.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }))
		toggle?.click()

		expect(document.querySelector(".cm-callout-wrapper")?.classList.contains("is-collapsed")).toBe(
			false,
		)
		expect(document.querySelectorAll(".cm-callout-line").length).toBe(2)
		expect(view.state.selection.main.anchor).toBe(selectionBefore)
	})

	it("collapses an expanded callout without moving the editor selection", () => {
		const content = "> [!tip]+ Expanded\n> Visible\n\ntail"
		const view = createBlockWidgetEditor(content)
		const selectionBefore = view.state.selection.main.anchor
		const toggle = document.querySelector<HTMLButtonElement>(
			".cm-callout-line [data-callout-toggle]",
		)

		toggle?.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }))
		toggle?.click()

		expect(document.querySelector(".cm-callout-wrapper")?.classList.contains("is-collapsed")).toBe(
			true,
		)
		expect(view.state.selection.main.anchor).toBe(selectionBefore)
	})

	it("keeps the callout background from covering selected text", () => {
		const content = "> [!tip]+ Expanded\n> Visible\n\ntail"
		const view = createBlockWidgetEditor(content)

		view.dispatch({ selection: { anchor: 0, head: content.indexOf("tail") } })

		const selectedCallout = document.querySelector(".cm-callout-wrapper.is-selection-overlap")
		expect(selectedCallout).not.toBeNull()
	})

	it("keeps one CodeMirror line for every source line across projected blocks", () => {
		const content = `---
title: Navigation
---

| A | B |
| --- | --- |
| One | Two |

> [!tip]- Folded
> Hidden

![Image](image.png)

---`

		const view = createBlockWidgetEditor(content)

		expect(document.querySelectorAll(".cm-line")).toHaveLength(view.state.doc.lines)
		expect(document.querySelectorAll(".cm-table-line")).toHaveLength(3)
		expect(document.querySelectorAll(".cm-table-rendered-line")).toHaveLength(3)
		expect(document.querySelectorAll(".cm-table-cell:not(.cm-table-delimiter-cell)")).toHaveLength(
			4,
		)
		expect(document.querySelectorAll(".cm-table-delimiter-cell")).toHaveLength(2)
		expect(document.querySelector(".cm-table-row-widget")).toBeNull()
		expect(document.querySelectorAll(".cm-frontmatter-line")).toHaveLength(3)
		expect(document.querySelectorAll(".cm-callout-line")).toHaveLength(2)
	})
})
