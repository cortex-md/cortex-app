import { commandRegistry, registerCommand } from "@cortex/commands"
import { noteCache, useEditorStore, useWorkspaceStore } from "@cortex/core"
import { EditorView } from "@cortex/editor/editor-view"
import { ReadingView } from "@cortex/editor/reading-view"
import { SideBySideView } from "@cortex/editor/side-by-side-view"
import { AppSettingsSchema, DEFAULT_APP_SETTINGS, useSettingsStore } from "@cortex/settings"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NotePropertiesPanel } from "../../../features/properties/NotePropertiesPanel"
import { PaneView } from "../../../features/split-view/PaneView"

vi.mock("@cortex/editor/editor-view", () => ({
	EditorView: vi.fn(() => null),
}))

vi.mock("@cortex/editor/reading-view", () => ({
	ReadingView: vi.fn(() => null),
}))

vi.mock("@cortex/editor/side-by-side-view", () => ({
	SideBySideView: vi.fn(() => null),
}))

vi.mock("../../../features/split-view/NoteHeader", () => ({
	NoteHeader: () => <div data-testid="note-header" />,
}))

vi.mock("../../../features/properties/NotePropertiesPanel", () => ({
	NotePropertiesPanel: vi.fn(() => <div data-testid="note-properties" />),
}))

function setPaneTab(isSuspended = false) {
	useWorkspaceStore.setState({
		panes: {
			root: {
				id: "root",
				activeTabId: "tab-1",
				tabs: [
					{
						id: "tab-1",
						tabType: "file",
						filePath: "/vault/note.md",
						viewId: null,
						viewState: null,
						title: "note",
						isPinned: false,
						isDirty: false,
						isEphemeral: false,
						lastAccessed: 1,
						isSuspended,
					},
				],
			},
		},
		splitTree: { type: "leaf", id: "root" },
		activePaneId: "root",
		mruOrder: ["tab-1"],
		recentlyClosed: [],
	})
}

function setMarkdownToolbarEnabled(markdownToolbar: boolean) {
	useSettingsStore.setState({
		settings: AppSettingsSchema.parse({
			...DEFAULT_APP_SETTINGS,
			editor: {
				...DEFAULT_APP_SETTINGS.editor,
				markdownToolbar,
			},
		}),
	})
}

describe("PaneView", () => {
	beforeEach(() => {
		setPaneTab(true)
		setMarkdownToolbarEnabled(false)
		useEditorStore.setState({ mode: "live-preview" })
		vi.mocked(EditorView).mockClear()
		vi.mocked(ReadingView).mockClear()
		vi.mocked(SideBySideView).mockClear()
		vi.mocked(NotePropertiesPanel).mockClear()
		registerCommand({
			id: "format.bold",
			label: "Bold",
			category: "Format",
			execute: vi.fn(),
		})
	})

	afterEach(() => {
		cleanup()
		commandRegistry.clear()
		noteCache.clear()
		vi.restoreAllMocks()
	})

	it("renders suspended tabs without reading note cache or mounting editor views", () => {
		const readEntrySpy = vi.spyOn(noteCache, "readEntry").mockResolvedValue({
			filePath: "/vault/note.md",
			content: "# Suspended",
			diskContent: "# Suspended",
			mtime: 1,
			hash: "hash",
			dirty: false,
			lastAccessed: 1,
			openTabCount: 0,
			snapshots: [],
		})

		render(<PaneView paneId="root" />)

		expect(screen.getByText("Tab suspended - click to resume")).toBeInTheDocument()
		expect(readEntrySpy).not.toHaveBeenCalled()
		expect(EditorView).not.toHaveBeenCalled()
		expect(ReadingView).not.toHaveBeenCalled()
		expect(SideBySideView).not.toHaveBeenCalled()
	})

	it("uses cached projection for editor body and note properties", () => {
		setPaneTab()
		const readEntrySpy = vi.spyOn(noteCache, "readEntry")
		noteCache.primeClean("/vault/note.md", "---\ntags:\n  - cached\n---\n# Body", "hash")

		render(<PaneView paneId="root" />)

		expect(readEntrySpy).not.toHaveBeenCalled()
		expect(vi.mocked(EditorView).mock.calls[0]?.[0]).toMatchObject({
			content: "# Body",
		})
		expect(vi.mocked(NotePropertiesPanel).mock.calls[0]?.[0]).toMatchObject({
			filePath: "/vault/note.md",
			rawContent: "---\ntags:\n  - cached\n---\n# Body",
			projection: expect.objectContaining({
				body: "# Body",
				meta: { tags: ["cached"] },
				frontmatterError: null,
			}),
		})
	})

	it("does not mount the Markdown toolbar when the setting is disabled", () => {
		setPaneTab()
		noteCache.primeClean("/vault/note.md", "# Note", "hash")

		render(<PaneView paneId="root" />)

		expect(screen.queryByRole("toolbar", { name: "Markdown formatting" })).not.toBeInTheDocument()
	})

	it.each([
		"source",
		"live-preview",
		"side-by-side",
	] as const)("mounts the Markdown toolbar in %s mode when enabled", (mode) => {
		setPaneTab()
		setMarkdownToolbarEnabled(true)
		useEditorStore.setState({ mode })
		noteCache.primeClean("/vault/note.md", "# Note", "hash")

		render(<PaneView paneId="root" />)

		expect(screen.getByRole("toolbar", { name: "Markdown formatting" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument()
	})

	it("does not mount the Markdown toolbar in reading mode", () => {
		setPaneTab()
		setMarkdownToolbarEnabled(true)
		useEditorStore.setState({ mode: "reading" })
		noteCache.primeClean("/vault/note.md", "# Note", "hash")

		render(<PaneView paneId="root" />)

		expect(screen.queryByRole("toolbar", { name: "Markdown formatting" })).not.toBeInTheDocument()
	})
})
