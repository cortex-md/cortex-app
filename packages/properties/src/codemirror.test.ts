import { history, undo } from "@codemirror/commands"
import * as codeMirrorState from "@codemirror/state"
import { EditorSelection, EditorState } from "@codemirror/state"
import * as codeMirrorView from "@codemirror/view"
import { EditorView } from "@codemirror/view"
import { beforeAll } from "vitest"
import {
	createFrontmatterExtension,
	getFrontmatterEditorState,
	updateFrontmatterEditorState,
} from "./codemirror"

const body = "First line\nSecond line"
const codeMirrorRuntime = {
	state: codeMirrorState,
	view: codeMirrorView,
}

beforeAll(() => {
	if (!Range.prototype.getClientRects) {
		Range.prototype.getClientRects = () => [] as unknown as DOMRectList
	}
	if (!Range.prototype.getBoundingClientRect) {
		Range.prototype.getBoundingClientRect = () => new DOMRect()
	}
})

function createView(
	onChange?: (meta: Record<string, unknown>) => void,
	onError?: (error: Error) => void,
) {
	const parent = document.createElement("div")
	document.body.append(parent)
	return new EditorView({
		parent,
		state: EditorState.create({
			doc: body,
			extensions: [
				history(),
				createFrontmatterExtension({
					initialMeta: { title: "Protected" },
					onChange,
					onError,
				})(codeMirrorRuntime),
			],
		}),
	})
}

describe("createFrontmatterExtension", () => {
	it("keeps metadata outside the CodeMirror document", async () => {
		const onChange = vi.fn()
		const view = createView(onChange)
		expect(view.state.doc.toString()).toBe(body)
		await expect(getFrontmatterEditorState(view.state)).resolves.toEqual({
			meta: { title: "Protected" },
			error: null,
		})
		expect(onChange).toHaveBeenCalledWith({ title: "Protected" })
		view.destroy()
	})

	it("allows body typing, paste, selection deletion, and undo", () => {
		const view = createView()
		view.dispatch({ changes: { from: 0, insert: "Changed " } })
		expect(view.state.doc.toString()).toBe(`Changed ${body}`)
		view.dispatch({
			selection: EditorSelection.range(0, 7),
			changes: { from: 0, to: 7, insert: "Pasted" },
		})
		expect(view.state.doc.toString()).toBe(`Pasted ${body}`)
		expect(undo(view)).toBe(true)
		expect(view.state.doc.toString()).toBe(body)
		view.destroy()
	})

	it("keeps cursor movement and body selections unconstrained", () => {
		const view = createView()
		view.dispatch({ selection: { anchor: body.length } })
		expect(view.state.selection.main.head).toBe(body.length)
		view.dispatch({ selection: EditorSelection.range(0, body.length) })
		expect(view.state.selection.main.from).toBe(0)
		expect(view.state.selection.main.to).toBe(body.length)
		view.destroy()
	})

	it("updates metadata without changing the document or undo history", async () => {
		const onChange = vi.fn()
		const view = createView(onChange)
		await updateFrontmatterEditorState(view, { title: "Remote" })
		expect(view.state.doc.toString()).toBe(body)
		await expect(getFrontmatterEditorState(view.state)).resolves.toEqual({
			meta: { title: "Remote" },
			error: null,
		})
		expect(onChange).toHaveBeenLastCalledWith({ title: "Remote" })
		expect(undo(view)).toBe(false)
		view.destroy()
	})

	it("publishes malformed frontmatter state without blocking body edits", async () => {
		const onError = vi.fn()
		const view = createView(undefined, onError)
		await updateFrontmatterEditorState(view, {}, "Malformed YAML")
		expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Malformed YAML" }))
		view.dispatch({ changes: { from: body.length, insert: " changed" } })
		expect(view.state.doc.toString()).toBe(`${body} changed`)
		view.destroy()
	})
})
