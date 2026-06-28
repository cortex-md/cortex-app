import { useHotkeysStore } from "@cortex/hotkeys"
import { getPlatform } from "@cortex/platform"
import { AppSettingsSchema, DEFAULT_APP_SETTINGS, useSettingsStore } from "@cortex/settings"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../../features/sync/NoteHistoryPanel", () => ({
	NoteHistoryPanel: () => null,
}))

import { useDragStore, useTagsStore, useVaultStore, useWorkspaceStore } from "@cortex/core"
import { FileSidebar } from "../../../features/file-explorer/FileSidebar"
import {
	FILE_EXPLORER_COMMAND_EVENT,
	FILE_EXPLORER_COMMAND_IDS,
} from "../../../features/file-explorer/fileExplorerCommands"
import {
	FILE_TREE_ROW_HEIGHT,
	FILE_TREE_ROW_STEP,
	getFileTreeDepthStyle,
} from "../../../features/file-explorer/fileTreeLayout"
import { NativeMenuActions } from "../../../utils/context-menu"

const ROOT_PANE_ID = "root"

function resetWorkspace() {
	useWorkspaceStore.setState({
		panes: {
			[ROOT_PANE_ID]: { id: ROOT_PANE_ID, tabs: [], activeTabId: null },
		},
		splitTree: { type: "leaf", id: ROOT_PANE_ID },
		activePaneId: ROOT_PANE_ID,
		mruOrder: [],
		recentlyClosed: [],
	})
}

function renderFileSidebar() {
	useVaultStore.setState({
		vault: {
			uuid: "vault",
			path: "/vault",
			name: "Vault",
			fileCount: 3,
		},
		files: [
			{ path: "/vault/Folder", name: "Folder", isDir: true },
			{ path: "/vault/Folder/Nested.md", name: "Nested.md", isDir: false },
			{ path: "/vault/Note.md", name: "Note.md", isDir: false },
		],
	})

	render(<FileSidebar />)
}

function enableNativeMenuPlatform() {
	const previousPlatform = getPlatform()
	vi.mocked(getPlatform).mockReturnValue({
		...previousPlatform,
		capabilities: ["menu"],
	} as never)
	return () => vi.mocked(getPlatform).mockReturnValue(previousPlatform as never)
}

beforeEach(() => {
	resetWorkspace()
	useDragStore.setState({ dragSource: null, dropTarget: null })
	useTagsStore.setState({ tagIndex: {}, tagColors: {}, fileTags: {}, activeTagFilter: null })
	useSettingsStore.setState({ settings: AppSettingsSchema.parse(DEFAULT_APP_SETTINGS) })
	useHotkeysStore.setState({
		bindings: [],
		parsedBindings: [],
		handlers: {},
		overrides: {},
	})
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("FileSidebar native context menus", () => {
	it("opens the note menu without also opening the empty-space menu", () => {
		const restorePlatform = enableNativeMenuPlatform()
		const showContextMenu = vi
			.spyOn(NativeMenuActions.prototype, "showContextMenu")
			.mockResolvedValue(undefined)

		try {
			renderFileSidebar()

			fireEvent.contextMenu(screen.getByRole("treeitem", { name: "Note" }), {
				clientX: 12,
				clientY: 20,
			})

			expect(showContextMenu).toHaveBeenCalledTimes(1)
			const menuIds = showContextMenu.mock.calls[0][0].items.map((item) =>
				item.type === "separator" ? "separator" : item.id,
			)
			expect(menuIds).toContain("open-new-tab")
			expect(menuIds).toContain("delete")
			expect(menuIds).not.toContain("new-file")
			expect(showContextMenu.mock.calls[0][0].position).toEqual({ x: 12, y: 20 })
		} finally {
			showContextMenu.mockRestore()
			restorePlatform()
		}
	})

	it("keeps the empty-space menu available from the tree surface", () => {
		const restorePlatform = enableNativeMenuPlatform()
		const showContextMenu = vi
			.spyOn(NativeMenuActions.prototype, "showContextMenu")
			.mockResolvedValue(undefined)

		try {
			renderFileSidebar()

			fireEvent.contextMenu(screen.getByRole("tree"), { clientX: 30, clientY: 40 })

			expect(showContextMenu).toHaveBeenCalledTimes(1)
			expect(
				showContextMenu.mock.calls[0][0].items.map((item) =>
					item.type === "separator" ? "separator" : item.id,
				),
			).toEqual(["new-file", "new-folder"])
			expect(showContextMenu.mock.calls[0][0].position).toEqual({ x: 30, y: 40 })
		} finally {
			showContextMenu.mockRestore()
			restorePlatform()
		}
	})
})

describe("FileSidebar tab opening", () => {
	it("reuses the active tab after a single note click", () => {
		useWorkspaceStore.getState().openTab("/vault/Open.md")
		const initialTab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]
		renderFileSidebar()

		fireEvent.click(screen.getByRole("treeitem", { name: "Note" }))

		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs).toHaveLength(1)
		expect(pane.tabs[0].id).toBe(initialTab.id)
		expect(pane.tabs[0].filePath).toBe("/vault/Note.md")
	})

	it("does not create a new tab on double click after the instant single click", () => {
		useWorkspaceStore.getState().openTab("/vault/Open.md")
		const initialTab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]
		renderFileSidebar()
		const note = screen.getByRole("treeitem", { name: "Note" })

		fireEvent.click(note)
		fireEvent.doubleClick(note)

		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs).toHaveLength(1)
		expect(pane.tabs[0].id).toBe(initialTab.id)
		expect(pane.tabs[0].filePath).toBe("/vault/Note.md")
		expect(pane.activeTabId).toBe(initialTab.id)
	})

	it("opens a missing note in a new tab on Ctrl click", () => {
		useWorkspaceStore.getState().openTab("/vault/Open.md")
		renderFileSidebar()

		fireEvent.click(screen.getByRole("treeitem", { name: "Note" }), { ctrlKey: true })

		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs.map((tab) => tab.filePath)).toEqual(["/vault/Open.md", "/vault/Note.md"])
		expect(pane.activeTabId).toBe(pane.tabs[1].id)
	})

	it("activates an existing note tab on Ctrl click instead of duplicating it", () => {
		useWorkspaceStore.getState().openTab("/vault/Note.md")
		useWorkspaceStore.getState().openTab("/vault/Open.md")
		renderFileSidebar()

		fireEvent.click(screen.getByRole("treeitem", { name: "Note" }), { ctrlKey: true })

		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs.map((tab) => tab.filePath)).toEqual(["/vault/Note.md", "/vault/Open.md"])
		expect(pane.activeTabId).toBe(pane.tabs[0].id)
	})
})

describe("FileSidebar drag behavior", () => {
	it("starts a file drag after pointer movement on note rows", () => {
		renderFileSidebar()
		const note = screen.getByRole("treeitem", { name: "Note" })

		expect(note).toHaveAttribute("draggable", "false")
		fireEvent.pointerDown(note, { button: 0, clientX: 0, clientY: 0, isPrimary: true })
		fireEvent.pointerMove(document, { clientX: 8, clientY: 0, isPrimary: true })

		expect(useDragStore.getState().dragSource).toEqual({
			type: "file",
			filePath: "/vault/Note.md",
			isDirectory: false,
		})

		fireEvent.pointerCancel(document, { isPrimary: true })
		expect(useDragStore.getState().dragSource).toBeNull()
	})

	it("starts a folder drag after pointer movement on folder rows", () => {
		renderFileSidebar()
		const folder = screen.getByRole("treeitem", { name: "Folder" })

		expect(folder).toHaveAttribute("draggable", "false")
		fireEvent.pointerDown(folder, { button: 0, clientX: 0, clientY: 0, isPrimary: true })
		fireEvent.pointerMove(document, { clientX: 8, clientY: 0, isPrimary: true })

		expect(useDragStore.getState().dragSource).toEqual({
			type: "file",
			filePath: "/vault/Folder",
			isDirectory: true,
		})

		fireEvent.pointerCancel(document, { isPrimary: true })
	})

	it("disables drag while a note is being renamed", () => {
		renderFileSidebar()
		const note = screen.getByRole("treeitem", { name: "Note" })

		fireEvent.focus(note)
		fireEvent.keyDown(note, { key: "F2" })

		expect(screen.getByDisplayValue("Note.md")).toBeInTheDocument()
		expect(screen.getByDisplayValue("Note.md")).toHaveClass("file-tree-inline-input")
		expect(note).toHaveAttribute("draggable", "false")
	})
})

describe("FileSidebar keyboard navigation", () => {
	it("moves focus with arrow keys and opens notes without leaving the tree", () => {
		renderFileSidebar()
		const tree = screen.getByRole("tree")

		fireEvent.focus(tree)
		fireEvent.keyDown(tree, { key: "ArrowDown" })
		expect(screen.getByRole("treeitem", { name: "Note" })).toHaveClass("focused")

		fireEvent.keyDown(tree, { key: "Enter" })

		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0].filePath).toBe("/vault/Note.md")
		expect(tree).toHaveFocus()
	})

	it("uses Vim navigation keys when Vim mode is enabled", () => {
		useSettingsStore.setState({
			settings: AppSettingsSchema.parse({
				...DEFAULT_APP_SETTINGS,
				editor: { ...DEFAULT_APP_SETTINGS.editor, vimMode: true },
			}),
		})
		renderFileSidebar()
		const tree = screen.getByRole("tree")

		fireEvent.focus(tree)
		fireEvent.keyDown(tree, { key: "j" })
		fireEvent.keyDown(tree, { key: "l" })

		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0].filePath).toBe("/vault/Note.md")
		expect(tree).toHaveFocus()
	})

	it("opens the focused context menu target from the editable shortcut", () => {
		renderFileSidebar()
		const tree = screen.getByRole("tree")
		const note = screen.getByRole("treeitem", { name: "Note" })
		const handleContextMenu = vi.fn()
		note.addEventListener("contextmenu", handleContextMenu)

		fireEvent.focus(tree)
		fireEvent.keyDown(tree, { key: "ArrowDown" })
		fireEvent.keyDown(tree, { key: "F10", shiftKey: true })

		expect(handleContextMenu).toHaveBeenCalled()
	})

	it("ignores file explorer command events when the tree is not focused", () => {
		renderFileSidebar()

		window.dispatchEvent(
			new CustomEvent(FILE_EXPLORER_COMMAND_EVENT, {
				detail: { commandId: FILE_EXPLORER_COMMAND_IDS.rename },
			}),
		)

		expect(screen.queryByDisplayValue("Folder")).not.toBeInTheDocument()
	})

	it("deletes the focused note from the editable shortcut", async () => {
		const deleteFile = vi.spyOn(useVaultStore.getState(), "deleteFile").mockResolvedValue(undefined)
		vi.mocked(getPlatform).mockReturnValue({
			capabilities: [],
			dialog: {
				showConfirm: vi.fn().mockResolvedValue(true),
			},
		} as never)
		renderFileSidebar()
		const tree = screen.getByRole("tree")

		fireEvent.focus(tree)
		fireEvent.keyDown(tree, { key: "ArrowDown" })
		fireEvent.keyDown(tree, { key: "Delete" })

		await waitFor(() => {
			expect(deleteFile).toHaveBeenCalledWith("/vault/Note.md")
		})
	})
})

describe("FileSidebar layout", () => {
	it("does not render tag color markers next to tagged notes", () => {
		useTagsStore.setState({
			fileTags: { "/vault/Note.md": ["project"] },
			tagColors: { project: "#ef4444" },
		})

		renderFileSidebar()

		expect(screen.getByRole("treeitem", { name: "Note" })).toBeInTheDocument()
		expect(screen.queryByTitle("project")).not.toBeInTheDocument()
	})

	it("uses a compact virtual step around Minimal-sized rows", () => {
		expect(FILE_TREE_ROW_HEIGHT).toBe(25)
		expect(FILE_TREE_ROW_STEP).toBe(27)
		expect(getFileTreeDepthStyle(2)).toEqual({
			"--file-tree-depth": 2,
			"--file-tree-guide-width": "36px",
			"--file-tree-indent": "46px",
			"--file-tree-row-height": "25px",
		})
	})

	it("passes nested depth through typed CSS properties", () => {
		renderFileSidebar()
		fireEvent.click(screen.getByRole("treeitem", { name: "Folder" }))

		const nestedRow = screen.getByRole("treeitem", { name: "Nested" }).closest(".file-tree-row")

		expect(nestedRow).not.toBeNull()
		expect((nestedRow as HTMLElement).style.getPropertyValue("--file-tree-depth")).toBe("1")
		expect((nestedRow as HTMLElement).style.getPropertyValue("--file-tree-guide-width")).toBe(
			"18px",
		)
		expect((nestedRow as HTMLElement).style.height).toBe("27px")
	})

	it("uses the same depth contract for inline creation rows", () => {
		renderFileSidebar()
		fireEvent.click(screen.getByRole("button", { name: "New Folder" }))

		const createInput = screen.getByDisplayValue("New Folder")
		const createRow = createInput.closest(".file-tree-row")

		expect(createInput).toHaveClass("file-tree-inline-input")
		expect(createRow).not.toBeNull()
		expect((createRow as HTMLElement).style.getPropertyValue("--file-tree-depth")).toBe("0")
		expect(createInput.closest(".file-tree-create-row")).not.toBeNull()
		expect(
			createInput.closest(".file-tree-create-row")?.querySelector("svg.lucide-chevron-right"),
		).not.toBeNull()
	})

	it("omits the markdown extension from the inline note creation input", () => {
		renderFileSidebar()
		fireEvent.click(screen.getByRole("button", { name: "New Note" }))

		const createInput = screen.getByDisplayValue("Untitled")
		const createContainer = createInput.closest(".file-tree-create-row")

		expect(screen.queryByDisplayValue("Untitled.md")).not.toBeInTheDocument()
		expect(createInput).toHaveClass("file-tree-inline-input")
		expect(createContainer).not.toBeNull()
		expect(createContainer).toHaveAttribute("data-create-type", "file")
		expect(createContainer?.querySelector("svg")).toBeNull()
	})

	it("commits inline creation once when Enter is followed by blur", async () => {
		const createFile = vi
			.spyOn(useVaultStore.getState(), "createFile")
			.mockResolvedValue("/vault/Untitled.md")
		renderFileSidebar()
		fireEvent.click(screen.getByRole("button", { name: "New Note" }))
		const createInput = screen.getByDisplayValue("Untitled")

		fireEvent.keyDown(createInput, { key: "Enter" })
		fireEvent.blur(createInput)

		await waitFor(() => {
			expect(createFile).toHaveBeenCalledTimes(1)
		})
		expect(createFile).toHaveBeenCalledWith("/vault", "Untitled")
	})
})
