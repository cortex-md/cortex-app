import { markdown } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import { registerMarkdownInline, registerMarkdownSemantic } from "@cortex/renderer"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import {
	getLivePreviewMetrics,
	livePreviewExtension,
	resetLivePreviewMetrics,
} from "../livePreview"
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

describe("unified live preview engine", () => {
	it("runs one block pass and one viewport pass for a document update", () => {
		resetLivePreviewMetrics()
		const parent = document.createElement("div")
		document.body.appendChild(parent)
		const content = Array.from({ length: 5000 }, (_, index) => `line ${index}`).join("\n")
		const view = new EditorView({
			state: EditorState.create({
				doc: content,
				extensions: [markdown(), livePreviewExtension(editorRuntime)],
			}),
			parent,
		})
		editorViews.push(view)
		expect(getLivePreviewMetrics()).toMatchObject({ blockPasses: 1, viewportPasses: 1 })
		expect(getLivePreviewMetrics().candidateBlocks).toBe(0)

		view.dispatch({ changes: { from: content.length, insert: "\nnext" } })

		expect(getLivePreviewMetrics()).toMatchObject({ blockPasses: 2, viewportPasses: 2 })
	})

	it("projects semantic registrations into visible editor text", () => {
		const parent = document.createElement("div")
		document.body.appendChild(parent)
		const content = "semantic text\ncursor"
		const view = new EditorView({
			state: EditorState.create({
				doc: content,
				selection: { anchor: content.length },
				extensions: [markdown(), livePreviewExtension(editorRuntime)],
			}),
			parent,
		})
		editorViews.push(view)

		const dispose = registerMarkdownSemantic({
			id: "semantic-mark",
			selector: { type: "text" },
			transform: ({ source }) =>
				source.includes("semantic")
					? {
							type: "span",
							className: "semantic-mark",
							children: [{ type: "text", value: source }],
						}
					: null,
		})

		expect(document.querySelector(".semantic-mark")?.textContent).toContain("semantic")
		dispose()
		expect(document.querySelector(".semantic-mark")).toBeNull()
	})

	it("updates open editors when an inline registration changes", () => {
		const parent = document.createElement("div")
		document.body.appendChild(parent)
		const content = "plugin tail"
		const view = new EditorView({
			state: EditorState.create({
				doc: content,
				selection: { anchor: content.length },
				extensions: [markdown(), livePreviewExtension(editorRuntime)],
			}),
			parent,
		})
		editorViews.push(view)

		const dispose = registerMarkdownInline({
			id: "plugin-mark",
			pattern: "plugin",
			replacement: { type: "mark", className: "plugin-mark" },
		})
		expect(document.querySelector(".plugin-mark")?.textContent).toBe("plugin")

		dispose()
		expect(document.querySelector(".plugin-mark")).toBeNull()
	})

	it("projects inline math without touching code or money text", () => {
		const parent = document.createElement("div")
		document.body.appendChild(parent)
		const content = "Formula $x^2$ and `$raw$`, price $20 and $30"
		const view = new EditorView({
			state: EditorState.create({
				doc: content,
				selection: { anchor: content.length },
				extensions: [markdown(), livePreviewExtension(editorRuntime)],
			}),
			parent,
		})
		editorViews.push(view)

		const math = document.querySelector<HTMLElement>(".cm-math-inline")
		expect(math?.textContent).toBe("x^2")
		expect(document.querySelectorAll(".cm-math-inline")).toHaveLength(1)
		expect(document.querySelector(".cm-content")?.textContent).toContain("$raw$")
		expect(document.querySelector(".cm-content")?.textContent).toContain("$20 and $30")
	})

	it("reveals inline math source while the selection overlaps it", () => {
		const parent = document.createElement("div")
		document.body.appendChild(parent)
		const content = "Formula $x^2$ tail"
		const view = new EditorView({
			state: EditorState.create({
				doc: content,
				selection: { anchor: content.length },
				extensions: [markdown(), livePreviewExtension(editorRuntime)],
			}),
			parent,
		})
		editorViews.push(view)

		expect(document.querySelector(".cm-math-inline")).not.toBeNull()

		const mathStart = content.indexOf("$x^2$")
		view.dispatch({ selection: { anchor: mathStart, head: mathStart + 5 } })

		expect(document.querySelector(".cm-math-inline")).toBeNull()
		expect(document.querySelector(".cm-content")?.textContent).toContain("$x^2$")
	})

	it("does not override CodeMirror arrow navigation", () => {
		const parent = document.createElement("div")
		document.body.appendChild(parent)
		const view = new EditorView({
			state: EditorState.create({
				doc: "> [!tip]- Folded\n> Hidden\n\ntail",
				extensions: [markdown(), livePreviewExtension(editorRuntime)],
			}),
			parent,
		})
		editorViews.push(view)

		const livePreviewArrowBindings = view.state
			.facet(keymap)
			.flat()
			.filter((binding) =>
				["ArrowUp", "ArrowDown", "Shift-ArrowUp", "Shift-ArrowDown"].includes(binding.key ?? ""),
			)

		expect(livePreviewArrowBindings).toHaveLength(0)
	})
})
