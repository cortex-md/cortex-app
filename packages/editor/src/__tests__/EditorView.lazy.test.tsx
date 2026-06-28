import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const harness = vi.hoisted(() => {
	let resolveRuntime: ((runtime: unknown) => void) | null = null
	const loadEditorRuntime = vi.fn()
	const baseExtensions = vi.fn(() => [])
	const reconfigureEditor = vi.fn()
	const editorViews: FakeEditorView[] = []

	class FakeDocument {
		constructor(private value: string) {}

		get length() {
			return this.value.length
		}

		toString() {
			return this.value
		}

		replace(value: string) {
			this.value = value
		}

		line(position: number) {
			return this.lineAt(position)
		}

		lineAt(position: number) {
			const before = this.value.slice(0, position)
			const lineNumber = before.split("\n").length
			const from = before.lastIndexOf("\n") + 1
			const nextBreak = this.value.indexOf("\n", position)
			const to = nextBreak === -1 ? this.value.length : nextBreak
			return {
				from,
				to,
				number: lineNumber,
				text: this.value.slice(from, to),
			}
		}

		sliceString(from: number, to?: number) {
			return this.value.slice(from, to)
		}
	}

	class FakeEditorView {
		static updateListener = {
			of(listener: unknown) {
				return { listener }
			},
		}

		scrollDOM = document.createElement("div")
		dom = document.createElement("div")
		visibleRanges = [{ from: 0, to: 0 }]
		dispatch = vi.fn((spec: { changes?: { insert?: string } }) => {
			if (spec.changes?.insert !== undefined) {
				this.state.doc.replace(spec.changes.insert)
			}
		})
		destroy = vi.fn()
		state: {
			doc: FakeDocument
			selection: { main: { from: number; to: number; head: number }; ranges: never[] }
			sliceDoc(from: number, to?: number): string
			field(): unknown
		}

		constructor(config: { state: { doc: string }; parent: HTMLElement }) {
			this.state = {
				doc: new FakeDocument(config.state.doc),
				selection: { main: { from: 0, to: 0, head: 0 }, ranges: [] },
				sliceDoc: (from, to) => this.state.doc.sliceString(from, to),
				field: () => undefined,
			}
			config.parent.append(this.dom)
			editorViews.push(this)
		}
	}

	const runtime = {
		state: {
			EditorState: {
				create(config: unknown) {
					return config
				},
			},
			Transaction: {
				remote: { of: vi.fn() },
				addToHistory: { of: vi.fn() },
			},
		},
		view: { EditorView: FakeEditorView },
	}

	function resetRuntimePromise() {
		loadEditorRuntime.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveRuntime = resolve
				}),
		)
	}

	function resolve() {
		resolveRuntime?.(runtime)
	}

	return {
		baseExtensions,
		editorViews,
		loadEditorRuntime,
		reconfigureEditor,
		resetRuntimePromise,
		resolve,
		runtime,
	}
})

vi.mock("../runtime", () => ({
	loadEditorRuntime: harness.loadEditorRuntime,
}))

vi.mock("../extensions", () => ({
	DEFAULT_EDITOR_CONFIG: {
		fontSize: 16,
		wordWrap: true,
		folding: true,
		tabSize: 2,
		useSpaces: true,
		showLineNumbers: false,
		vimMode: false,
	},
	baseExtensions: harness.baseExtensions,
	reconfigureEditor: harness.reconfigureEditor,
}))

import { EditorView } from "../EditorView"

afterEach(() => {
	cleanup()
	harness.editorViews.length = 0
	harness.loadEditorRuntime.mockReset()
	harness.baseExtensions.mockClear()
	harness.reconfigureEditor.mockClear()
})

describe("EditorView lazy runtime", () => {
	it("mounts after the runtime resolves and reports the view once", async () => {
		harness.resetRuntimePromise()
		const onViewReady = vi.fn()

		render(
			<EditorView
				content="Initial"
				filePath="/vault/initial.md"
				onChange={vi.fn()}
				onViewReady={onViewReady}
			/>,
		)

		expect(onViewReady).not.toHaveBeenCalled()
		harness.resolve()

		await waitFor(() => expect(onViewReady).toHaveBeenCalledTimes(1))
		expect(harness.editorViews[0].state.doc.toString()).toBe("Initial")
	})

	it("ignores runtime resolution after unmount", async () => {
		harness.resetRuntimePromise()
		const onViewReady = vi.fn()
		const { unmount } = render(
			<EditorView
				content="Initial"
				filePath="/vault/initial.md"
				onChange={vi.fn()}
				onViewReady={onViewReady}
			/>,
		)

		unmount()
		harness.resolve()
		await Promise.resolve()

		expect(onViewReady).not.toHaveBeenCalled()
		expect(harness.editorViews).toHaveLength(0)
	})

	it("uses the latest content and file path when props change before load completes", async () => {
		harness.resetRuntimePromise()
		const { rerender } = render(
			<EditorView content="Old" filePath="/vault/old.md" onChange={vi.fn()} />,
		)

		rerender(<EditorView content="New" filePath="/vault/new.md" onChange={vi.fn()} />)
		harness.resolve()

		await waitFor(() => expect(harness.editorViews).toHaveLength(1))
		expect(harness.editorViews[0].state.doc.toString()).toBe("New")
		expect(harness.baseExtensions).toHaveBeenCalledWith(
			harness.runtime,
			expect.any(Object),
			expect.objectContaining({ filePath: "/vault/new.md" }),
		)
	})

	it("reconfigures an existing view without recreating it", async () => {
		harness.resetRuntimePromise()
		const { rerender } = render(
			<EditorView content="Body" filePath="/vault/body.md" onChange={vi.fn()} />,
		)
		harness.resolve()
		await waitFor(() => expect(harness.editorViews).toHaveLength(1))

		rerender(
			<EditorView
				content="Body"
				filePath="/vault/body.md"
				editorConfig={{
					fontSize: 18,
					wordWrap: false,
					folding: true,
					tabSize: 4,
					useSpaces: false,
					showLineNumbers: true,
					vimMode: false,
				}}
				onChange={vi.fn()}
			/>,
		)

		expect(harness.editorViews).toHaveLength(1)
		expect(harness.reconfigureEditor).toHaveBeenCalledWith(
			harness.runtime,
			harness.editorViews[0],
			expect.objectContaining({ fontSize: 18 }),
			expect.objectContaining({
				filePath: "/vault/body.md",
				livePreview: true,
				scrollMode: "internal",
			}),
		)
	})

	it("reconfigures Live Preview on an existing view when the mode changes", async () => {
		harness.resetRuntimePromise()
		const resolveImageUrl = vi.fn((src: string) => src)
		const { rerender } = render(
			<EditorView
				content="# Body"
				filePath="/vault/body.md"
				livePreview={false}
				resolveImageUrl={resolveImageUrl}
				onChange={vi.fn()}
			/>,
		)
		harness.resolve()
		await waitFor(() => expect(harness.editorViews).toHaveLength(1))

		rerender(
			<EditorView
				content="# Body"
				filePath="/vault/body.md"
				livePreview={true}
				resolveImageUrl={resolveImageUrl}
				onChange={vi.fn()}
			/>,
		)

		expect(harness.editorViews).toHaveLength(1)
		expect(harness.reconfigureEditor).toHaveBeenCalledWith(
			harness.runtime,
			harness.editorViews[0],
			expect.any(Object),
			expect.objectContaining({
				filePath: "/vault/body.md",
				livePreview: true,
				resolveImageUrl,
				scrollMode: "internal",
			}),
		)
	})

	it("applies remote content changes after the view is ready", async () => {
		harness.resetRuntimePromise()
		const { rerender } = render(
			<EditorView content="First" filePath="/vault/first.md" onChange={vi.fn()} />,
		)
		harness.resolve()
		await waitFor(() => expect(harness.editorViews).toHaveLength(1))

		rerender(<EditorView content="Second" filePath="/vault/second.md" onChange={vi.fn()} />)

		expect(harness.editorViews[0].dispatch).toHaveBeenCalledWith(
			expect.objectContaining({
				changes: { from: 0, to: 5, insert: "Second" },
			}),
		)
		expect(harness.editorViews[0].state.doc.toString()).toBe("Second")
	})
})
