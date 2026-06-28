import { markdown } from "@codemirror/lang-markdown"
import { EditorState } from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import { GFM } from "@lezer/markdown"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { loadEditorRuntime } from "../runtime"
import {
	type SlashCommandItem,
	type SlashCommandMenuState,
	slashCommandExtension,
} from "../slashCommands"

const editorViews: EditorView[] = []
const slashCommandItems: SlashCommandItem[] = [
	{
		id: "format.heading-1",
		label: "Heading 1",
		category: "Format",
		aliases: ["heading-1"],
	},
	{
		id: "format.heading-2",
		label: "Heading 2",
		category: "Format",
		aliases: ["heading-2"],
	},
	{
		id: "format.bold",
		label: "Bold",
		category: "Format",
		aliases: ["bold"],
	},
]

let editorRuntime: Awaited<ReturnType<typeof loadEditorRuntime>>

beforeAll(async () => {
	editorRuntime = await loadEditorRuntime()
})

afterEach(() => {
	for (const view of editorViews.splice(0)) view.destroy()
	document.body.replaceChildren()
	vi.restoreAllMocks()
})

function runKey(view: EditorView, key: string): boolean {
	for (const binding of view.state.facet(keymap).flat()) {
		if (binding.key === key && binding.run?.(view)) return true
	}
	return false
}

function createClientRect(left: number, top: number, bottom: number): DOMRect {
	return {
		x: left,
		y: top,
		width: 0,
		height: bottom - top,
		top,
		right: left,
		bottom,
		left,
		toJSON: () => ({}),
	} as DOMRect
}

function createSlashEditor({
	content = "",
	selection = content.length,
	readonly = false,
}: {
	content?: string
	selection?: number
	readonly?: boolean
} = {}) {
	let latestState: SlashCommandMenuState | null = null
	const states: Array<SlashCommandMenuState | null> = []
	const executed: string[] = []
	const parent = document.createElement("div")
	document.body.appendChild(parent)
	const view = new EditorView({
		state: EditorState.create({
			doc: content,
			selection: { anchor: selection },
			extensions: [
				markdown({ extensions: GFM }),
				readonly ? EditorState.readOnly.of(true) : [],
				slashCommandExtension(editorRuntime, {
					getItems: () => slashCommandItems,
					onStateChange: (state) => {
						latestState = state
						states.push(state)
					},
					onExecuteCommand: (commandId) => {
						executed.push(commandId)
					},
				}),
			],
		}),
		parent,
	})
	vi.spyOn(view, "requestMeasure").mockImplementation((request) => {
		if (!request) return
		request.write?.(request.read(view), view)
	})
	editorViews.push(view)
	return {
		view,
		states,
		executed,
		get latestState() {
			return latestState
		},
	}
}

describe("slash commands", () => {
	it("opens from a valid slash trigger and applies the selected command", () => {
		const editor = createSlashEditor()

		editor.view.dispatch({ changes: { from: 0, insert: "/hea" }, selection: { anchor: 4 } })

		expect(editor.latestState?.query).toBe("hea")
		expect(editor.latestState?.items.map((item) => item.id)).toEqual([
			"format.heading-1",
			"format.heading-2",
		])

		expect(runKey(editor.view, "ArrowDown")).toBe(true)
		expect(editor.latestState?.selectedIndex).toBe(1)
		expect(runKey(editor.view, "Enter")).toBe(true)

		expect(editor.view.state.doc.toString()).toBe("")
		expect(editor.view.state.selection.main.head).toBe(0)
		expect(editor.executed).toEqual(["format.heading-2"])
		expect(editor.states.at(-1)).toBeNull()
	})

	it("does not open after a slash embedded in a word", () => {
		const editor = createSlashEditor()

		editor.view.dispatch({ changes: { from: 0, insert: "path/" }, selection: { anchor: 5 } })

		expect(editor.latestState).toBeNull()
	})

	it("does not open inside fenced code", () => {
		const content = "```ts\n/\n```"
		const slashPosition = content.indexOf("/") + 1
		const editor = createSlashEditor({ content, selection: slashPosition })

		editor.view.dispatch({
			changes: { from: slashPosition, insert: "hea" },
			selection: { anchor: slashPosition + 3 },
		})

		expect(editor.latestState).toBeNull()
		expect(editor.executed).toEqual([])
	})

	it("does not open in read-only editor state", () => {
		const editor = createSlashEditor({ readonly: true })

		editor.view.dispatch({ changes: { from: 0, insert: "/" }, selection: { anchor: 1 } })

		expect(editor.latestState).toBeNull()
	})

	it("positions the menu from the caret instead of the slash trigger", () => {
		const editor = createSlashEditor()
		vi.spyOn(editor.view.dom, "getBoundingClientRect").mockReturnValue(createClientRect(8, 12, 32))
		const coordsAtPos = vi.spyOn(editor.view, "coordsAtPos").mockImplementation((position) => {
			if (position === 0) return createClientRect(24, 40, 58)
			if (position === 4) return createClientRect(148, 88, 106)
			return null
		})

		editor.view.dispatch({ changes: { from: 0, insert: "/hea" }, selection: { anchor: 4 } })

		expect(editor.latestState?.position).toEqual({
			left: 148,
			top: 116,
			placement: "bottom",
		})
		expect(coordsAtPos).toHaveBeenCalledWith(4, -1)
	})
})
