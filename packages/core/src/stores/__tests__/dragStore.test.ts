import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { noteCache } from "../../noteCache"
import { useDragStore } from "../../stores/dragStore"
import { useVaultStore } from "../../stores/vaultStore"
import { useWorkspaceStore } from "../../stores/workspaceStore"

const ROOT_PANE_ID = "root"

function buildInitial() {
	return {
		panes: {
			[ROOT_PANE_ID]: { id: ROOT_PANE_ID, tabs: [], activeTabId: null },
		},
		splitTree: { type: "leaf" as const, id: ROOT_PANE_ID },
		activePaneId: ROOT_PANE_ID,
		mruOrder: [],
		recentlyClosed: [],
	}
}

beforeEach(() => {
	useWorkspaceStore.setState(buildInitial())
	useDragStore.setState({ dragSource: null, dropTarget: null })
	vi.spyOn(noteCache, "openTab").mockImplementation(() => {})
	vi.spyOn(noteCache, "closeTab").mockResolvedValue()
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe("completeDrop()", () => {
	it("opens a dragged file in the target pane center", async () => {
		useWorkspaceStore.getState().openTab("/vault/open.md")
		useWorkspaceStore.getState().splitPane(ROOT_PANE_ID, "horizontal")
		const targetPaneId = useWorkspaceStore.getState().activePaneId

		useDragStore.getState().startDrag({ type: "file", filePath: "/vault/dragged.md" })
		useDragStore.getState().updateDropTarget({ paneId: targetPaneId, zone: "center" })
		await useDragStore.getState().completeDrop()

		const targetPane = useWorkspaceStore.getState().panes[targetPaneId]
		expect(targetPane.tabs).toHaveLength(1)
		expect(targetPane.tabs[0].filePath).toBe("/vault/dragged.md")
	})

	it("creates a split for dragged file edge drops", async () => {
		useWorkspaceStore.getState().openTab("/vault/open.md")

		useDragStore.getState().startDrag({ type: "file", filePath: "/vault/dragged.md" })
		useDragStore.getState().updateDropTarget({ paneId: ROOT_PANE_ID, zone: "right" })
		await useDragStore.getState().completeDrop()

		const { splitTree, panes, activePaneId } = useWorkspaceStore.getState()
		expect(splitTree.type).toBe("split")
		if (splitTree.type === "split") {
			expect(splitTree.direction).toBe("horizontal")
		}
		expect(Object.keys(panes)).toHaveLength(2)
		expect(panes[activePaneId].tabs[0].filePath).toBe("/vault/dragged.md")
	})

	it("treats an edge drop on the only empty pane as a center drop", async () => {
		useDragStore.getState().startDrag({ type: "file", filePath: "/vault/dragged.md" })
		useDragStore.getState().updateDropTarget({ paneId: ROOT_PANE_ID, zone: "right" })
		await useDragStore.getState().completeDrop()

		const { splitTree, panes } = useWorkspaceStore.getState()
		expect(splitTree).toEqual({ type: "leaf", id: ROOT_PANE_ID })
		expect(panes[ROOT_PANE_ID].tabs[0].filePath).toBe("/vault/dragged.md")
	})

	it("opens a new view instance for each sidebar view drop", async () => {
		for (let index = 0; index < 2; index++) {
			useDragStore.getState().startDrag({
				type: "sidebar-view",
				viewId: "emoji-browser",
				viewTitle: "Emoji",
			})
			useDragStore.getState().updateDropTarget({ paneId: ROOT_PANE_ID, zone: "center" })
			await useDragStore.getState().completeDrop()
		}

		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs).toHaveLength(2)
		expect(pane.tabs.every((tab) => tab.viewId === "emoji-browser")).toBe(true)
	})

	it("opens a dragged file at a tab insertion target", async () => {
		useWorkspaceStore.getState().openTab("/vault/a.md")
		useWorkspaceStore.getState().openTab("/vault/b.md")

		useDragStore.getState().startDrag({ type: "file", filePath: "/vault/dragged.md" })
		useDragStore.getState().updateDropTarget({
			type: "tab",
			paneId: ROOT_PANE_ID,
			insertIndex: 1,
		})
		await useDragStore.getState().completeDrop()

		expect(
			useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs.map((tab) => tab.filePath),
		).toEqual(["/vault/a.md", "/vault/dragged.md", "/vault/b.md"])
	})

	it("moves a dragged tab at a tab insertion target", async () => {
		useWorkspaceStore.getState().openTab("/vault/a.md")
		useWorkspaceStore.getState().openTab("/vault/b.md")
		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		const secondTabId = pane.tabs[1].id

		useDragStore.getState().startDrag({
			type: "tab",
			tabId: secondTabId,
			sourcePaneId: ROOT_PANE_ID,
		})
		useDragStore.getState().updateDropTarget({
			type: "tab",
			paneId: ROOT_PANE_ID,
			insertIndex: 0,
		})
		await useDragStore.getState().completeDrop()

		expect(
			useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs.map((tab) => tab.filePath),
		).toEqual(["/vault/b.md", "/vault/a.md"])
	})

	it("moves a dragged file for file tree targets", async () => {
		const moveFile = vi
			.spyOn(useVaultStore.getState(), "moveFile")
			.mockResolvedValue("/vault/Folder/a.md")

		useDragStore.getState().startDrag({
			type: "file",
			filePath: "/vault/a.md",
			isDirectory: false,
		})
		useDragStore.getState().updateDropTarget({
			type: "file-tree",
			fileTreePath: "/vault/Folder",
			fileTreeParentPath: "/vault/Folder",
			fileTreePosition: "inside",
		})
		await useDragStore.getState().completeDrop()

		expect(moveFile).toHaveBeenCalledWith("/vault/a.md", "/vault/Folder")
	})
})
