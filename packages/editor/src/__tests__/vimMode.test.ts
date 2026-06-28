import { undo } from "@codemirror/commands"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { getCM, Vim } from "@replit/codemirror-vim"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { baseExtensions, DEFAULT_EDITOR_CONFIG, reconfigureEditor } from "../extensions"
import { loadEditorRuntime } from "../runtime"
import type { VimCommandProvider } from "../types"

const editorViews: EditorView[] = []
let editorRuntime: Awaited<ReturnType<typeof loadEditorRuntime>>

beforeAll(async () => {
	editorRuntime = await loadEditorRuntime()
})

afterEach(() => {
	for (const view of editorViews.splice(0)) view.destroy()
	document.body.replaceChildren()
})

interface CreateEditorOptions {
	content?: string
	livePreview?: boolean
}

function createEditor(
	vimMode: boolean,
	vimCommands?: VimCommandProvider,
	options: CreateEditorOptions = {},
): EditorView {
	const parent = document.createElement("div")
	document.body.appendChild(parent)
	const view = new EditorView({
		state: EditorState.create({
			doc: options.content ?? "alpha beta\ngamma",
			extensions: [
				...baseExtensions(
					editorRuntime,
					{ ...DEFAULT_EDITOR_CONFIG, vimMode },
					{ livePreview: options.livePreview ?? false, vimCommands },
				),
			],
		}),
		parent,
	})
	editorViews.push(view)
	return view
}

function keyCodeForKey(key: string): number {
	if (key.length === 1) return key.toUpperCase().charCodeAt(0)
	if (key === "Escape") return 27
	if (key === "Enter") return 13
	if (key === "Tab") return 9
	if (key === "ArrowDown") return 40
	if (key === "ArrowUp") return 38
	return 0
}

function dispatchEditorKey(view: EditorView, key: string): boolean {
	view.focus()
	const event = new KeyboardEvent("keydown", {
		bubbles: true,
		cancelable: true,
		key,
	})
	Object.defineProperty(event, "keyCode", { value: keyCodeForKey(key) })
	view.contentDOM.dispatchEvent(event)
	return event.defaultPrevented
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

describe("Vim mode", () => {
	it("is disabled by default", () => {
		const view = createEditor(false)

		expect(getCM(view)).toBeNull()
		expect(view.scrollDOM.classList.contains("cm-vimMode")).toBe(false)
		expect(document.querySelector(".cm-vimCursorLayer")).toBeNull()
	})

	it("toggles without recreating the editor or changing its document", () => {
		const view = createEditor(false)
		const originalDocument = view.state.doc.toString()
		view.dispatch({ changes: { from: view.state.doc.length, insert: " delta" } })
		const editedDocument = view.state.doc.toString()

		reconfigureEditor(editorRuntime, view as never, { ...DEFAULT_EDITOR_CONFIG, vimMode: true })

		expect(getCM(view)).not.toBeNull()
		expect(view.scrollDOM.classList.contains("cm-vimMode")).toBe(true)
		expect(document.querySelector(".cm-vimCursorLayer")).not.toBeNull()
		expect(document.querySelector(".cm-selectionLayer")).not.toBeNull()
		expect(view.state.doc.toString()).toBe(editedDocument)

		reconfigureEditor(editorRuntime, view as never, { ...DEFAULT_EDITOR_CONFIG, vimMode: false })

		expect(getCM(view)).toBeNull()
		expect(view.scrollDOM.classList.contains("cm-vimMode")).toBe(false)
		expect(document.querySelector(".cm-vimCursorLayer")).toBeNull()
		expect(view.state.doc.toString()).toBe(editedDocument)
		expect(undo(view)).toBe(true)
		expect(view.state.doc.toString()).toBe(originalDocument)
	})

	it("supports visual selection and the command-line panel", () => {
		const view = createEditor(true)
		const vimEditor = getCM(view)

		expect(vimEditor).not.toBeNull()
		Vim.handleKey(vimEditor as NonNullable<typeof vimEditor>, "v", "user")
		Vim.handleKey(vimEditor as NonNullable<typeof vimEditor>, "l", "user")
		expect(view.state.selection.main.empty).toBe(false)

		Vim.handleKey(vimEditor as NonNullable<typeof vimEditor>, "<Esc>", "user")
		expect(view.state.selection.main.empty).toBe(true)

		Vim.handleKey(vimEditor as NonNullable<typeof vimEditor>, ":", "user")
		expect(document.querySelector(".cm-panel.cm-vim-panel")).not.toBeNull()
		const commandInput = document.querySelector<HTMLInputElement>(".cm-vim-panel input")
		expect(commandInput).not.toBeNull()

		const escapeEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
		Object.defineProperty(escapeEvent, "keyCode", { value: 27 })
		commandInput?.dispatchEvent(escapeEvent)
		expect(document.querySelector(".cm-panel.cm-vim-panel")).toBeNull()
	})

	it("keeps selected live preview blocks readable in visual mode", () => {
		const view = createEditor(true, undefined, {
			content: "```ts\nconst value = 1\n```\n\ntail",
			livePreview: true,
		})
		const vimEditor = getCM(view)

		expect(vimEditor).not.toBeNull()
		Vim.handleKey(vimEditor as NonNullable<typeof vimEditor>, "v", "user")
		Vim.handleKey(vimEditor as NonNullable<typeof vimEditor>, "l", "user")

		expect(view.state.selection.main.empty).toBe(false)
		expect(document.querySelector(".cm-codeblock-wrapper.is-selection-overlap")).not.toBeNull()
	})

	it("navigates rendered table cells with Vim normal-mode keys", () => {
		const content = "before\n| A | B |\n| --- | --- |\n| C | D |\nafter"
		const view = createEditor(true, undefined, { content, livePreview: true })

		view.dispatch({ selection: { anchor: content.indexOf("A") } })
		expect(dispatchEditorKey(view, "l")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("B"))

		expect(dispatchEditorKey(view, "h")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("A"))

		expect(dispatchEditorKey(view, "j")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("C"))

		expect(dispatchEditorKey(view, "k")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("A"))
	})

	it("does not steal Vim character movement inside a table cell", () => {
		const content = "| Alpha | Beta |\n| --- | --- |"
		const view = createEditor(true, undefined, { content, livePreview: true })

		view.dispatch({ selection: { anchor: content.indexOf("Alpha") + 2 } })
		dispatchEditorKey(view, "l")
		expect(view.state.selection.main.anchor).toBeLessThan(content.indexOf("Beta"))
	})

	it("enters tables from adjacent lines with Vim vertical movement", () => {
		const content = "before\n| A | B |\n| --- | --- |\n| C | D |\nafter"
		const view = createEditor(true, undefined, { content, livePreview: true })

		view.dispatch({ selection: { anchor: content.indexOf("before") } })
		expect(dispatchEditorKey(view, "j")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("A"))

		view.dispatch({ selection: { anchor: content.indexOf("after") } })
		expect(dispatchEditorKey(view, "k")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("C"))
	})

	it("writes into the selected cell after Vim table navigation enters insert mode", () => {
		const content = "| A | B |\n| --- | --- |\n| C | D |"
		const view = createEditor(true, undefined, { content, livePreview: true })
		const vimEditor = getCM(view)

		expect(vimEditor).not.toBeNull()
		view.dispatch({ selection: { anchor: content.indexOf("A") } })
		expect(dispatchEditorKey(view, "l")).toBe(true)
		expect(view.state.selection.main.anchor).toBe(content.indexOf("B"))

		Vim.handleKey(vimEditor as NonNullable<typeof vimEditor>, "i", "user")
		typeTextThroughDom(view, "X")

		expect(view.state.doc.toString()).toBe("| A | XB |\n| --- | --- |\n| C | D |")
	})

	it("does not read Vim command providers when Vim mode is disabled", () => {
		const provider: VimCommandProvider = {
			getChoices: vi.fn(() => []),
			execute: vi.fn(() => false),
			subscribe: vi.fn(() => () => {}),
		}

		createEditor(false, provider)

		expect(provider.getChoices).not.toHaveBeenCalled()
		expect(provider.subscribe).not.toHaveBeenCalled()
	})

	it("executes Cortex commands from the Vim command line", () => {
		const provider: VimCommandProvider = {
			getChoices: () => [
				{
					name: "file_new",
					commandId: "file.new",
					label: "New Note",
					category: "File",
					isPrimary: true,
				},
			],
			execute: vi.fn(() => true),
			subscribe: () => () => {},
		}
		const view = createEditor(true, provider)
		const vimEditor = getCM(view)

		Vim.handleKey(vimEditor as NonNullable<typeof vimEditor>, ":", "user")
		const commandInput = document.querySelector<HTMLInputElement>(".cm-vim-panel input")
		expect(commandInput).not.toBeNull()
		commandInput!.value = "file_new"
		const enterEvent = new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
		Object.defineProperty(enterEvent, "keyCode", { value: 13 })
		commandInput!.dispatchEvent(enterEvent)

		expect(provider.execute).toHaveBeenCalledWith("file_new", "file_new")
	})

	it("shows command hints and completes the first match with Tab", () => {
		const provider: VimCommandProvider = {
			getChoices: () => [
				{
					name: "file_new",
					commandId: "file.new",
					label: "New Note",
					category: "File",
					isPrimary: true,
				},
			],
			execute: () => true,
			subscribe: () => () => {},
		}
		const view = createEditor(true, provider)
		const vimEditor = getCM(view)

		Vim.handleKey(vimEditor as NonNullable<typeof vimEditor>, ":", "user")
		const commandInput = document.querySelector<HTMLInputElement>(".cm-vim-panel input")
		expect(commandInput).not.toBeNull()
		expect(document.querySelector(".cm-vim-command-hint-name")?.textContent).toBe("file_new")

		commandInput!.value = "file"
		commandInput!.dispatchEvent(new Event("input", { bubbles: true }))
		const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
		Object.defineProperty(tabEvent, "keyCode", { value: 9 })
		commandInput!.dispatchEvent(tabEvent)

		expect(commandInput!.value).toBe("file_new")
	})

	it("navigates command hints with arrow keys and completes the selected command", () => {
		const provider: VimCommandProvider = {
			getChoices: () => [
				{
					name: "file_new",
					commandId: "file.new",
					label: "New Note",
					category: "File",
					isPrimary: true,
				},
				{
					name: "file_close_tab",
					commandId: "file.close-tab",
					label: "Close Tab",
					category: "File",
					isPrimary: true,
				},
			],
			execute: () => true,
			subscribe: () => () => {},
		}
		const view = createEditor(true, provider)
		const vimEditor = getCM(view)

		Vim.handleKey(vimEditor as NonNullable<typeof vimEditor>, ":", "user")
		const commandInput = document.querySelector<HTMLInputElement>(".cm-vim-panel input")
		expect(commandInput).not.toBeNull()

		commandInput!.value = "file"
		commandInput!.dispatchEvent(new Event("input", { bubbles: true }))
		const arrowDownEvent = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
		Object.defineProperty(arrowDownEvent, "keyCode", { value: 40 })
		commandInput!.dispatchEvent(arrowDownEvent)

		expect(
			document.querySelector('[data-selected="true"] .cm-vim-command-hint-name')?.textContent,
		).toBe("file_close_tab")

		const tabEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
		Object.defineProperty(tabEvent, "keyCode", { value: 9 })
		commandInput!.dispatchEvent(tabEvent)

		expect(commandInput!.value).toBe("file_close_tab")
	})

	it("completes and executes a partial command on Enter", () => {
		const provider: VimCommandProvider = {
			getChoices: () => [
				{
					name: "search_vault",
					commandId: "editor.find-in-vault",
					label: "Search in Vault",
					category: "Navigate",
					isPrimary: true,
				},
			],
			execute: vi.fn(() => true),
			subscribe: () => () => {},
		}
		const view = createEditor(true, provider)
		const vimEditor = getCM(view)

		Vim.handleKey(vimEditor as NonNullable<typeof vimEditor>, ":", "user")
		const commandInput = document.querySelector<HTMLInputElement>(".cm-vim-panel input")
		expect(commandInput).not.toBeNull()

		commandInput!.value = "sea"
		commandInput!.dispatchEvent(new Event("input", { bubbles: true }))
		const enterEvent = new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
		Object.defineProperty(enterEvent, "keyCode", { value: 13 })
		commandInput!.dispatchEvent(enterEvent)

		expect(provider.execute).toHaveBeenCalledWith("search_vault", "search_vault")
	})
})
