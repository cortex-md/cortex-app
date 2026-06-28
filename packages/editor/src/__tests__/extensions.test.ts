import { registerMarkdownInline } from "@cortex/renderer"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import {
	baseExtensions,
	buildEditorTypographyRules,
	DEFAULT_EDITOR_CONFIG,
	reconfigureEditor,
} from "../extensions"
import { pluginFoldingExtension } from "../folding"
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

describe("buildEditorTypographyRules", () => {
	it("uses theme CSS variables for editor typography", () => {
		const rules = buildEditorTypographyRules(16)

		expect(rules["&"]).toMatchObject({
			fontSize: "var(--editor-font-size, 16px)",
			fontFamily:
				'var(--font-editor, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
			fontWeight: "var(--editor-font-weight, 400)",
		})
		expect(rules[".cm-scroller"]).toMatchObject({
			lineHeight: "var(--editor-line-height, 27px)",
		})
		expect(rules[".cm-content"]).toMatchObject({
			maxWidth: "var(--markdown-content-width, 720px)",
		})
		expect(rules[".cm-line"]).toMatchObject({
			position: "relative",
			zIndex: "2",
			padding: "0 var(--markdown-content-gutter, 40px)",
		})
		expect(rules[".cm-activeLine"]).toMatchObject({
			position: "relative",
			zIndex: "2",
			padding: "0 var(--markdown-content-gutter, 40px)",
		})
		expect(rules[".cm-content ::selection"]).toMatchObject({
			backgroundColor: "var(--editor-selection-bg, var(--bg-selected))",
		})
		expect(rules[".cm-fat-cursor"]).toMatchObject({
			background: "var(--accent) !important",
		})
		expect(rules["&:not(.cm-focused) .cm-fat-cursor"]).toMatchObject({
			background: "transparent !important",
			outline: "1px solid var(--accent) !important",
		})
		expect(rules[".cm-selectionBackground"]).toMatchObject({
			backgroundColor: "var(--editor-selection-bg, var(--bg-selected)) !important",
		})
		expect(rules[".cm-selectionLayer"]).toMatchObject({
			zIndex: "1 !important",
			pointerEvents: "none",
		})
		expect(rules[".cm-cursorLayer"]).toMatchObject({ zIndex: "4" })
		expect(rules[".cm-panel.cm-vim-panel"]).toMatchObject({
			backgroundColor: "var(--bg-elevated)",
			borderTop: "1px solid var(--border-subtle)",
		})
		expect(rules[".cm-panel.cm-vim-panel input"]).toMatchObject({
			backgroundColor: "transparent",
			border: "none",
			fontFamily: "var(--font-editor)",
		})
		expect(rules[".cm-panel.cm-search"]).toMatchObject({
			backgroundColor: "var(--bg-elevated)",
			borderBottom: "1px solid var(--border-subtle)",
		})
		expect(rules[".cm-searchMatch"]).toMatchObject({
			backgroundColor: "var(--editor-search-match-bg, var(--accent-subtle))",
		})
		expect(rules[".cm-searchMatch.cm-searchMatch-selected"]).toMatchObject({
			backgroundColor: "var(--editor-search-match-active-bg, var(--bg-selected))",
		})
	})

	it("supports parent-owned scrolling without making the CodeMirror scroller overflow", () => {
		const rules = buildEditorTypographyRules(16, "parent")

		expect(rules["&"]).toMatchObject({ height: "auto" })
		expect(rules["&"]).toMatchObject({ minHeight: "inherit" })
		expect(rules[".cm-scroller"]).toMatchObject({ overflow: "visible" })
		expect(rules[".cm-content"]).toMatchObject({ padding: "8px 0 24px" })
	})
})

describe("baseExtensions", () => {
	it("does not install the autocomplete suggestion panel", async () => {
		const parent = document.createElement("div")
		document.body.appendChild(parent)
		const content = "```ts\ncon\n```"
		const view = new editorRuntime.view.EditorView({
			state: editorRuntime.state.EditorState.create({
				doc: content,
				selection: { anchor: content.indexOf("con") + "con".length },
				extensions: [
					...baseExtensions(editorRuntime, DEFAULT_EDITOR_CONFIG, { livePreview: false }),
				],
			}),
			parent,
		})
		editorViews.push(view)

		const handled = editorRuntime.autocomplete.startCompletion(view)
		await Promise.resolve()

		expect(handled).toBe(false)
		expect(editorRuntime.autocomplete.completionStatus(view.state)).toBeNull()
		expect(document.querySelector(".cm-tooltip-autocomplete")).toBeNull()
	})

	it("reconfigures Live Preview projections on an existing editor", () => {
		const dispose = registerMarkdownInline({
			id: "editor-test-mark",
			pattern: "plugin",
			replacement: { type: "mark", className: "editor-test-mark" },
		})
		try {
			const parent = document.createElement("div")
			document.body.appendChild(parent)
			const view = new editorRuntime.view.EditorView({
				state: editorRuntime.state.EditorState.create({
					doc: "plugin tail",
					selection: { anchor: "plugin tail".length },
					extensions: [
						...baseExtensions(editorRuntime, DEFAULT_EDITOR_CONFIG, { livePreview: false }),
					],
				}),
				parent,
			})
			editorViews.push(view)

			expect(document.querySelector(".editor-test-mark")).toBeNull()

			reconfigureEditor(editorRuntime, view, DEFAULT_EDITOR_CONFIG, { livePreview: true })

			expect(document.querySelector(".editor-test-mark")?.textContent).toBe("plugin")

			reconfigureEditor(editorRuntime, view, DEFAULT_EDITOR_CONFIG, { livePreview: false })

			expect(document.querySelector(".editor-test-mark")).toBeNull()
		} finally {
			dispose()
		}
	})

	it("provides fold ranges for headings, fenced code, blockquotes, and lists", () => {
		const parent = document.createElement("div")
		document.body.appendChild(parent)
		const content = [
			"# Heading",
			"Body",
			"## Child",
			"Child body",
			"```json",
			'{ "enabled": true }',
			"```",
			"> Quote",
			"> More",
			"- One",
			"- Two",
		].join("\n")
		const view = new editorRuntime.view.EditorView({
			state: editorRuntime.state.EditorState.create({
				doc: content,
				extensions: [
					...baseExtensions(editorRuntime, DEFAULT_EDITOR_CONFIG, { livePreview: false }),
				],
			}),
			parent,
		})
		editorViews.push(view)

		const firstLine = view.state.doc.line(1)
		const codeLine = view.state.doc.line(5)
		const quoteLine = view.state.doc.line(8)
		const listLine = view.state.doc.line(10)

		expect(parent.querySelector(".cm-fold-hover-control")).not.toBeNull()
		expect(editorRuntime.language.foldable(view.state, firstLine.from, firstLine.to)).toEqual({
			from: firstLine.to,
			to: view.state.doc.line(11).to,
		})
		expect(editorRuntime.language.foldable(view.state, codeLine.from, codeLine.to)).toEqual({
			from: codeLine.to,
			to: view.state.doc.line(7).to,
		})
		expect(editorRuntime.language.foldable(view.state, quoteLine.from, quoteLine.to)).toEqual({
			from: quoteLine.to,
			to: view.state.doc.line(9).to,
		})
		expect(editorRuntime.language.foldable(view.state, listLine.from, listLine.to)).toEqual({
			from: listLine.to,
			to: view.state.doc.line(11).to,
		})
	})

	it("adds portable plugin fold providers without CodeMirror APIs", () => {
		const parent = document.createElement("div")
		document.body.appendChild(parent)
		const content = [":::spoiler", "hidden", ":::"].join("\n")
		const view = new editorRuntime.view.EditorView({
			state: editorRuntime.state.EditorState.create({
				doc: content,
				extensions: [
					...baseExtensions(editorRuntime, DEFAULT_EDITOR_CONFIG, {
						filePath: "/vault/Note.md",
						livePreview: false,
					}),
					pluginFoldingExtension(editorRuntime, [
						{
							id: "spoiler",
							getFoldRange: (context) => {
								expect(context.filePath).toBe("/vault/Note.md")
								expect(context.lineNumber).toBe(1)
								expect(context.getLine(2)).toBe("hidden")
								return context.lineText === ":::spoiler"
									? { toLine: 3, placeholder: "spoiler" }
									: null
							},
						},
					]),
				],
			}),
			parent,
		})
		editorViews.push(view)

		const firstLine = view.state.doc.line(1)

		expect(editorRuntime.language.foldable(view.state, firstLine.from, firstLine.to)).toEqual({
			from: firstLine.to,
			to: view.state.doc.line(3).to,
		})
	})

	it("does not install folding controls when the editor setting is disabled", () => {
		const parent = document.createElement("div")
		document.body.appendChild(parent)
		const view = new editorRuntime.view.EditorView({
			state: editorRuntime.state.EditorState.create({
				doc: "# Heading\nBody",
				extensions: [
					...baseExtensions(
						editorRuntime,
						{ ...DEFAULT_EDITOR_CONFIG, folding: false },
						{ livePreview: false },
					),
				],
			}),
			parent,
		})
		editorViews.push(view)

		expect(parent.querySelector(".cm-fold-hover-control")).toBeNull()
	})
})
