import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const editorMock = vi.hoisted(() => ({
	dispatch: vi.fn(),
	focus: vi.fn(),
	mounts: 0,
	unmounts: 0,
}))

vi.mock("@cortex/core", () => ({
	useVaultStore: vi.fn(),
}))

vi.mock("@cortex/settings", () => ({
	useSettingsStore: vi.fn(),
}))

vi.mock("@cortex/editor/editor-view", async () => {
	const React = await vi.importActual<typeof import("react")>("react")
	return {
		EditorView: ({
			content,
			onChange,
			onViewReady,
		}: {
			content: string
			onChange: (value: string) => void
			onViewReady: (view: unknown) => void
		}) => {
			React.useEffect(() => {
				editorMock.mounts += 1
				onViewReady({
					state: {
						selection: { main: { from: 0, to: 0 } },
						doc: { length: 0 },
					},
					dispatch: editorMock.dispatch,
					focus: editorMock.focus,
				})
				return () => {
					editorMock.unmounts += 1
				}
			}, [onViewReady])
			return (
				<textarea
					aria-label="Template body"
					value={content}
					onChange={(event) => onChange(event.target.value)}
				/>
			)
		},
	}
})

import { useVaultStore } from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import { TemplateEditorDialog } from "../../../features/templates/TemplateEditorDialog"
import type { TemplateEditorDraft } from "../../../features/templates/templateEditorDraft"

const settings = {
	appearance: { editorFontSize: 16 },
	editor: {
		wordWrap: true,
		folding: true,
		tabSize: 2,
		useSpaces: true,
		showLineNumbers: false,
		vimMode: false,
	},
}

const draft: TemplateEditorDraft = {
	name: "Weekly",
	description: "",
	body: "# {{ note.title }}",
	targetFolderPattern: "Reviews",
	fileNamePattern: "{{ note.title | slug }}",
	customPlaceholders: {},
}

beforeEach(() => {
	editorMock.mounts = 0
	editorMock.unmounts = 0
	vi.mocked(useSettingsStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = { settings }
		return selector ? selector(state) : state
	}) as never)
	vi.mocked(useVaultStore).mockImplementation(((selector?: (state: unknown) => unknown) => {
		const state = { vault: { path: "/vault", name: "Vault" } }
		return selector ? selector(state) : state
	}) as never)
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("TemplateEditorDialog", () => {
	it("inserts placeholders at the editor cursor", async () => {
		render(
			<TemplateEditorDialog
				open
				template={null}
				initialDraft={draft}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
			/>,
		)

		await userEvent.click(screen.getByLabelText("Template body"))
		await userEvent.click(screen.getByRole("button", { name: "note.title" }))

		expect(editorMock.dispatch).toHaveBeenCalledWith({
			changes: { from: 0, to: 0, insert: "{{ note.title }}" },
			selection: { anchor: 16 },
		})
		expect(editorMock.focus).toHaveBeenCalled()
	})

	it("saves the edited draft", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined)
		render(
			<TemplateEditorDialog
				open
				template={null}
				initialDraft={draft}
				onOpenChange={vi.fn()}
				onSave={onSave}
			/>,
		)

		await userEvent.clear(screen.getByLabelText("Template name"))
		await userEvent.type(screen.getByLabelText("Template name"), "Daily")
		await userEvent.click(screen.getByRole("button", { name: "Save template" }))

		await waitFor(() => {
			expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Daily" }))
		})
	})

	it("keeps the body editor mounted and focused while typing", async () => {
		render(
			<TemplateEditorDialog
				open
				template={null}
				initialDraft={draft}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
			/>,
		)

		const bodyEditor = screen.getByLabelText("Template body")
		await waitFor(() => expect(editorMock.mounts).toBe(1))
		await userEvent.click(bodyEditor)
		await userEvent.type(bodyEditor, "\nMore text")

		expect(editorMock.mounts).toBe(1)
		expect(editorMock.unmounts).toBe(0)
		expect(document.activeElement).toBe(bodyEditor)
	})

	it("inserts placeholders into the note title pattern when the title is focused", async () => {
		render(
			<TemplateEditorDialog
				open
				template={null}
				initialDraft={draft}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
			/>,
		)

		const titleInput = screen.getByLabelText("Note title")
		await userEvent.click(titleInput)
		await userEvent.keyboard("{End}")
		await userEvent.click(screen.getByRole("button", { name: "date.today" }))

		await waitFor(() => {
			expect(titleInput).toHaveValue("{{ note.title | slug }}{{ date.today }}")
		})
		expect(editorMock.dispatch).not.toHaveBeenCalled()
	})

	it("keeps focus while renaming a custom token", async () => {
		render(
			<TemplateEditorDialog
				open
				template={null}
				initialDraft={draft}
				onOpenChange={vi.fn()}
				onSave={vi.fn()}
			/>,
		)

		await userEvent.click(screen.getByLabelText("Add custom token"))
		const nameInput = screen.getByDisplayValue("custom.1")
		await userEvent.clear(nameInput)
		await userEvent.type(nameInput, "project.slug")

		expect(nameInput).toHaveValue("project.slug")
		expect(document.activeElement).toBe(nameInput)
	})
})
