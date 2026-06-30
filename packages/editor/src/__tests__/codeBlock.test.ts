import { markdown } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { CodeBlockEmbedDefinition } from "../codeBlockEmbeds"
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

function createCodeBlockEditor(
	content = "```ts\nconst first = 1\n```\n\n```ts\nconst second = 2\n```\n\ntail",
	codeBlockEmbeds?: readonly CodeBlockEmbedDefinition[],
): EditorView {
	const parent = document.createElement("div")
	document.body.appendChild(parent)
	const view = new EditorView({
		state: EditorState.create({
			doc: content,
			selection: { anchor: content.length },
			extensions: [markdown(), livePreviewExtension(editorRuntime, undefined, "", codeBlockEmbeds)],
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

	it("renders embed code blocks in place with an open action in the code chrome", () => {
		const openLivePreview = vi.fn()
		const content = [
			"```cortex-draw",
			'{"schema":"cortex.drawing","title":"System Sketch"}',
			"```",
			"",
			"tail",
		].join("\n")
		const view = createCodeBlockEditor(content, [
			{
				languages: ["cortex-draw"],
				render: () => null,
				renderLivePreview: ({ content: blockContent }) => ({
					title: JSON.parse(blockContent).title,
					description: "Excalidraw board",
					meta: "Updated today",
				}),
				openLivePreview,
				livePreviewOpenLabel: "Open",
			},
		])

		expect(document.querySelector(".cm-codeblock-embed-preview")?.textContent).toContain(
			"System Sketch",
		)
		expect(document.querySelector(".cm-content")?.textContent).not.toContain("cortex.drawing")

		const blockLine = document.querySelector<HTMLElement>(".cm-codeblock-line")
		blockLine?.dispatchEvent(new Event("pointerover", { bubbles: true }))
		const button = document.querySelector<HTMLButtonElement>(".cm-codeblock-action")

		expect(button?.textContent).toBe("Open")
		button?.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }))
		button?.click()

		expect(openLivePreview).toHaveBeenCalledTimes(1)
		expect(openLivePreview.mock.calls[0][0]).toMatchObject({
			content: expect.stringContaining("System Sketch"),
			sourceFrom: 0,
		})

		view.dispatch({ selection: { anchor: content.indexOf("cortex.drawing") } })
		expect(document.querySelector(".cm-codeblock-embed-preview")).toBeNull()
		expect(document.querySelector(".cm-content")?.textContent).toContain("cortex.drawing")
	})

	it("mounts host-owned embed previews and cleans them up when source is revealed", async () => {
		const cleanup = vi.fn()
		const content = "```cortex-draw\n{}\n```\n\ntail"
		const view = createCodeBlockEditor(content, [
			{
				languages: ["cortex-draw"],
				render: () => null,
				renderLivePreview: () => ({
					title: "Inline board",
					className: "is-test-board",
					mount: (container) => {
						container.textContent = "Mounted board"
						return cleanup
					},
				}),
			},
		])

		await new Promise((resolve) => setTimeout(resolve, 0))

		expect(document.querySelector(".cm-codeblock-embed-preview.is-test-board")).not.toBeNull()
		expect(document.querySelector(".cm-codeblock-embed-mount")?.textContent).toBe("Mounted board")

		view.dispatch({ selection: { anchor: content.indexOf("{}") } })

		expect(cleanup).toHaveBeenCalledTimes(1)
	})

	it("remounts host-owned embed previews when their signature changes", async () => {
		const cleanup = vi.fn()
		const content = "```cortex-draw\n{}\n```\n\ntail"
		const view = createCodeBlockEditor(content, [
			{
				languages: ["cortex-draw"],
				render: () => null,
				renderLivePreview: ({ content: blockContent }) => {
					const signature = blockContent.trim()
					return {
						title: "Inline board",
						className: "is-test-board",
						signature,
						mount: (container) => {
							container.textContent = `Mounted ${signature}`
							return cleanup
						},
					}
				},
			},
		])

		await new Promise((resolve) => setTimeout(resolve, 0))

		expect(document.querySelector(".cm-codeblock-embed-mount")?.textContent).toBe("Mounted {}")

		const sourceFrom = content.indexOf("{}")
		view.dispatch({
			changes: {
				from: sourceFrom,
				to: sourceFrom + 2,
				insert: '{"next":true}',
			},
		})
		await new Promise((resolve) => setTimeout(resolve, 0))

		expect(cleanup).toHaveBeenCalledTimes(1)
		expect(document.querySelector(".cm-codeblock-embed-mount")?.textContent).toBe(
			'Mounted {"next":true}',
		)
	})
})
