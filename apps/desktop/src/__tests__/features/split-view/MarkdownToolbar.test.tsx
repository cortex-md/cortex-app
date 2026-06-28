import { commandRegistry, registerCommand } from "@cortex/commands"
import type { EditorRuntimeView } from "@cortex/editor/types"
import { setEditorViewRef } from "@cortex/plugin-host-core"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MarkdownToolbar } from "../../../features/split-view/MarkdownToolbar"

vi.mock("@cortex/plugin-host-core", () => ({
	setEditorViewRef: vi.fn(),
}))

function createEditorView(): EditorRuntimeView {
	return { focus: vi.fn() } as unknown as EditorRuntimeView
}

afterEach(() => {
	cleanup()
	commandRegistry.clear()
	vi.clearAllMocks()
})

describe("MarkdownToolbar", () => {
	it("runs visible format commands through the command registry", async () => {
		const execute = vi.fn()
		const editorView = createEditorView()
		registerCommand({
			id: "format.bold",
			label: "Bold",
			category: "Format",
			execute,
		})

		render(<MarkdownToolbar getEditorView={() => editorView} />)

		await userEvent.click(screen.getByRole("button", { name: "Bold" }))

		expect(setEditorViewRef).toHaveBeenCalledWith(editorView)
		expect(editorView.focus).toHaveBeenCalled()
		expect(execute).toHaveBeenCalledWith({ source: "api" })
	})

	it("runs overflow format commands without duplicating markdown command logic", async () => {
		const execute = vi.fn()
		const editorView = createEditorView()
		registerCommand({
			id: "format.table",
			label: "Insert Table",
			category: "Format",
			execute,
		})

		render(<MarkdownToolbar getEditorView={() => editorView} />)

		await userEvent.click(screen.getByRole("button", { name: "More Markdown actions" }))
		await userEvent.click(screen.getByRole("menuitem", { name: "Insert Table" }))

		expect(setEditorViewRef).toHaveBeenCalledWith(editorView)
		expect(execute).toHaveBeenCalledWith({ source: "api" })
	})

	it("skips missing commands while keeping available actions usable", () => {
		registerCommand({
			id: "format.bold",
			label: "Bold",
			category: "Format",
			execute: vi.fn(),
		})

		render(<MarkdownToolbar getEditorView={() => createEditorView()} />)

		expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "Heading 1" })).not.toBeInTheDocument()
	})
})
