import { getPlatform } from "@cortex/platform"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { noteCache } from "../../noteCache"
import { useUIStore } from "../../stores/uiStore"
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
	useUIStore.setState({
		leftSidebarCollapsed: false,
		leftSidebarWidth: 240,
		leftSidebarView: "files",
		rightSidebarCollapsed: true,
	})
	vi.spyOn(noteCache, "openTab").mockImplementation(() => {})
	vi.spyOn(noteCache, "closeTab").mockResolvedValue()
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe("openTab()", () => {
	it("creates a new tab in the active pane", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs).toHaveLength(1)
		expect(pane.tabs[0].filePath).toBe("/vault/note.md")
	})

	it("sets the new tab as active", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		const { panes } = useWorkspaceStore.getState()
		const pane = panes[ROOT_PANE_ID]
		expect(pane.activeTabId).toBe(pane.tabs[0].id)
	})

	it("does not create duplicate tabs for same file", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		useWorkspaceStore.getState().openTab("/vault/note.md")
		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs).toHaveLength(1)
	})

	it("creates a duplicate tab when forceNew is true", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		useWorkspaceStore.getState().openTab("/vault/note.md", { forceNew: true })
		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs).toHaveLength(2)
		expect(pane.tabs.map((tab) => tab.filePath)).toEqual(["/vault/note.md", "/vault/note.md"])
	})

	it("activates existing tab when file is already open", () => {
		useWorkspaceStore.getState().openTab("/vault/first.md")
		useWorkspaceStore.getState().openTab("/vault/second.md")
		useWorkspaceStore.getState().openTab("/vault/first.md")
		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.activeTabId).toBe(pane.tabs.find((t) => t.filePath === "/vault/first.md")?.id)
	})

	it("reuses the active file tab when reuseActive is true", () => {
		useWorkspaceStore.getState().openTab("/vault/first.md")
		const firstTab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]

		useWorkspaceStore.getState().openTab("/vault/second.md", { reuseActive: true })

		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs).toHaveLength(1)
		expect(pane.tabs[0].id).toBe(firstTab.id)
		expect(pane.tabs[0].filePath).toBe("/vault/second.md")
		expect(noteCache.closeTab).toHaveBeenCalledWith("/vault/first.md")
	})

	it("activates an existing tab before reusing the active tab", () => {
		useWorkspaceStore.getState().openTab("/vault/first.md")
		useWorkspaceStore.getState().openTab("/vault/second.md")

		useWorkspaceStore.getState().openTab("/vault/first.md", { reuseActive: true })

		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs.map((tab) => tab.filePath)).toEqual(["/vault/first.md", "/vault/second.md"])
		expect(pane.activeTabId).toBe(pane.tabs[0].id)
	})

	it("does not reuse a pinned active tab", () => {
		useWorkspaceStore.getState().openTab("/vault/pinned.md")
		const pinnedTab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]
		useWorkspaceStore.getState().pinTab(pinnedTab.id, ROOT_PANE_ID)

		useWorkspaceStore.getState().openTab("/vault/second.md", { reuseActive: true })

		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs).toHaveLength(2)
		expect(pane.tabs.map((tab) => tab.filePath)).toEqual(["/vault/pinned.md", "/vault/second.md"])
	})

	it("calls noteCache.openTab with the file path", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		expect(noteCache.openTab).toHaveBeenCalledWith("/vault/note.md")
	})

	it("derives tab title from file name without extension", () => {
		useWorkspaceStore.getState().openTab("/vault/my-note.md")
		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs[0].title).toBe("my-note")
	})

	it("adds tab id to mruOrder", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		const { mruOrder, panes } = useWorkspaceStore.getState()
		const tabId = panes[ROOT_PANE_ID].tabs[0].id
		expect(mruOrder).toContain(tabId)
	})
})

describe("closeTab()", () => {
	function openAndGetTab(filePath: string) {
		useWorkspaceStore.getState().openTab(filePath)
		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		return pane.tabs.find((t) => t.filePath === filePath)!
	}

	it("removes the tab from the pane", () => {
		const tab = openAndGetTab("/vault/note.md")
		useWorkspaceStore.getState().closeTab(tab.id, ROOT_PANE_ID)
		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs).toHaveLength(0)
	})

	it("removes tab id from mruOrder", () => {
		const tab = openAndGetTab("/vault/note.md")
		useWorkspaceStore.getState().closeTab(tab.id, ROOT_PANE_ID)
		expect(useWorkspaceStore.getState().mruOrder).not.toContain(tab.id)
	})

	it("adds closed file to recentlyClosed", () => {
		const tab = openAndGetTab("/vault/note.md")
		useWorkspaceStore.getState().closeTab(tab.id, ROOT_PANE_ID)
		const { recentlyClosed } = useWorkspaceStore.getState()
		expect(recentlyClosed[0]?.filePath).toBe("/vault/note.md")
	})

	it("does not close pinned tabs", () => {
		const tab = openAndGetTab("/vault/pinned.md")
		useWorkspaceStore.getState().pinTab(tab.id, ROOT_PANE_ID)
		useWorkspaceStore.getState().closeTab(tab.id, ROOT_PANE_ID)
		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs).toHaveLength(1)
	})

	it("is a no-op when pane does not exist", () => {
		expect(() =>
			useWorkspaceStore.getState().closeTab("nonexistent", "nonexistent-pane"),
		).not.toThrow()
	})

	it("releases one note cache reference when another instance of the file remains", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		useWorkspaceStore.getState().openTab("/vault/note.md", { forceNew: true })
		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		useWorkspaceStore.getState().closeTab(pane.tabs[0].id, ROOT_PANE_ID)

		expect(noteCache.closeTab).toHaveBeenCalledTimes(1)
		expect(noteCache.closeTab).toHaveBeenCalledWith("/vault/note.md")
	})

	it("does not release note cache again when closing a suspended tab", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		const tab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]
		useWorkspaceStore.setState((s) => {
			s.panes[ROOT_PANE_ID].tabs[0].isSuspended = true
		})
		vi.mocked(noteCache.closeTab).mockClear()

		useWorkspaceStore.getState().closeTab(tab.id, ROOT_PANE_ID)

		expect(noteCache.closeTab).not.toHaveBeenCalled()
	})
})

describe("splitPane()", () => {
	it("creates a split node replacing the original leaf", () => {
		useWorkspaceStore.getState().splitPane(ROOT_PANE_ID, "horizontal")
		const { splitTree } = useWorkspaceStore.getState()
		expect(splitTree.type).toBe("split")
	})

	it("creates two panes after split", () => {
		useWorkspaceStore.getState().splitPane(ROOT_PANE_ID, "horizontal")
		const { panes } = useWorkspaceStore.getState()
		expect(Object.keys(panes)).toHaveLength(2)
	})

	it("sets activePaneId to the new pane after split", () => {
		useWorkspaceStore.getState().splitPane(ROOT_PANE_ID, "vertical")
		const { activePaneId, panes } = useWorkspaceStore.getState()
		expect(activePaneId).not.toBe(ROOT_PANE_ID)
		expect(panes[activePaneId]).toBeDefined()
	})

	it("uses equal 50/50 sizes for split children", () => {
		useWorkspaceStore.getState().splitPane(ROOT_PANE_ID, "horizontal")
		const { splitTree } = useWorkspaceStore.getState()
		if (splitTree.type === "split") {
			expect(splitTree.sizes).toEqual([50, 50])
		}
	})
})

describe("closePane()", () => {
	it("removes pane and collapses split when only one child remains", () => {
		useWorkspaceStore.getState().splitPane(ROOT_PANE_ID, "horizontal")
		const newPaneId = useWorkspaceStore.getState().activePaneId
		useWorkspaceStore.getState().closePane(newPaneId)
		const { panes, splitTree } = useWorkspaceStore.getState()
		expect(Object.keys(panes)).toHaveLength(1)
		expect(splitTree.type).toBe("leaf")
	})

	it("is a no-op when only one pane exists", () => {
		useWorkspaceStore.getState().closePane(ROOT_PANE_ID)
		expect(Object.keys(useWorkspaceStore.getState().panes)).toHaveLength(1)
	})
})

describe("activateTab()", () => {
	it("sets the pane activeTabId", () => {
		useWorkspaceStore.getState().openTab("/vault/a.md")
		useWorkspaceStore.getState().openTab("/vault/b.md")
		const { panes } = useWorkspaceStore.getState()
		const tabA = panes[ROOT_PANE_ID].tabs.find((t) => t.filePath === "/vault/a.md")!
		useWorkspaceStore.getState().activateTab(tabA.id, ROOT_PANE_ID)
		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].activeTabId).toBe(tabA.id)
	})

	it("moves activated tab to front of mruOrder", () => {
		useWorkspaceStore.getState().openTab("/vault/a.md")
		useWorkspaceStore.getState().openTab("/vault/b.md")
		const { panes } = useWorkspaceStore.getState()
		const tabA = panes[ROOT_PANE_ID].tabs.find((t) => t.filePath === "/vault/a.md")!
		useWorkspaceStore.getState().activateTab(tabA.id, ROOT_PANE_ID)
		expect(useWorkspaceStore.getState().mruOrder[0]).toBe(tabA.id)
	})

	it("unsuspends a suspended tab", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		const { panes } = useWorkspaceStore.getState()
		const tab = panes[ROOT_PANE_ID].tabs[0]
		useWorkspaceStore.setState((s) => {
			s.panes[ROOT_PANE_ID].tabs[0].isSuspended = true
		})
		vi.mocked(noteCache.openTab).mockClear()

		useWorkspaceStore.getState().activateTab(tab.id, ROOT_PANE_ID)

		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0].isSuspended).toBe(false)
		expect(noteCache.openTab).toHaveBeenCalledWith("/vault/note.md")
	})
})

describe("suspendInactiveTabs()", () => {
	it("releases cache ownership for stale inactive file tabs", () => {
		useWorkspaceStore.getState().openTab("/vault/old.md")
		useWorkspaceStore.getState().openTab("/vault/active.md")
		useWorkspaceStore.setState((s) => {
			s.panes[ROOT_PANE_ID].tabs[0].lastAccessed = 0
		})
		vi.mocked(noteCache.closeTab).mockClear()

		useWorkspaceStore.getState().suspendInactiveTabs()

		const oldTab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]
		const activeTab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[1]
		expect(oldTab.isSuspended).toBe(true)
		expect(activeTab.isSuspended).toBe(false)
		expect(noteCache.closeTab).toHaveBeenCalledWith("/vault/old.md")
	})

	it("preserves duplicate same-file tab ownership across suspend and resume", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		useWorkspaceStore.getState().openTab("/vault/note.md", { forceNew: true })
		useWorkspaceStore.setState((s) => {
			s.panes[ROOT_PANE_ID].tabs[0].lastAccessed = 0
		})
		vi.mocked(noteCache.closeTab).mockClear()

		useWorkspaceStore.getState().suspendInactiveTabs()

		const suspendedTab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]
		expect(suspendedTab.isSuspended).toBe(true)
		expect(noteCache.closeTab).toHaveBeenCalledTimes(1)
		expect(noteCache.closeTab).toHaveBeenCalledWith("/vault/note.md")

		vi.mocked(noteCache.openTab).mockClear()
		useWorkspaceStore.getState().activateTab(suspendedTab.id, ROOT_PANE_ID)

		expect(noteCache.openTab).toHaveBeenCalledTimes(1)
		expect(noteCache.openTab).toHaveBeenCalledWith("/vault/note.md")
	})
})

describe("moveTab()", () => {
	it("moves a tab from source pane to target pane", () => {
		// Open two files in root pane, then split so we have two panes with content
		useWorkspaceStore.getState().openTab("/vault/a.md")
		useWorkspaceStore.getState().openTab("/vault/b.md")
		useWorkspaceStore.getState().splitPane(ROOT_PANE_ID, "horizontal")
		const newPaneId = useWorkspaceStore.getState().activePaneId

		// Move one tab from root to new pane
		const tab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]
		useWorkspaceStore.getState().moveTab(tab.id, ROOT_PANE_ID, newPaneId)

		// Target pane should have the moved tab
		expect(useWorkspaceStore.getState().panes[newPaneId].tabs.some((t) => t.id === tab.id)).toBe(
			true,
		)
	})

	it("auto-closes source pane when it becomes empty after move", () => {
		// Open one tab, split, then move the only tab from root to new pane
		useWorkspaceStore.getState().openTab("/vault/note.md")
		useWorkspaceStore.getState().splitPane(ROOT_PANE_ID, "horizontal")
		const newPaneId = useWorkspaceStore.getState().activePaneId
		const tab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]
		useWorkspaceStore.getState().moveTab(tab.id, ROOT_PANE_ID, newPaneId)
		// Root pane has no tabs, so it gets closed — only one pane remains
		expect(Object.keys(useWorkspaceStore.getState().panes)).toHaveLength(1)
	})
})

describe("openViewTab()", () => {
	it("creates duplicate view tabs when forceNew is true", () => {
		useWorkspaceStore.getState().openViewTab("emoji-browser", "Emoji")
		useWorkspaceStore.getState().openViewTab("emoji-browser", "Emoji", { forceNew: true })
		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]

		expect(pane.tabs).toHaveLength(2)
		expect(pane.tabs.every((tab) => tab.viewId === "emoji-browser")).toBe(true)
	})

	it("preserves view state when moving a view tab", () => {
		useWorkspaceStore
			.getState()
			.openViewTab("emoji-browser", "Emoji", { viewState: { query: "ship" } })
		const tab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]
		useWorkspaceStore.getState().splitPane(ROOT_PANE_ID, "horizontal")
		const targetPaneId = useWorkspaceStore.getState().activePaneId

		useWorkspaceStore.getState().moveTab(tab.id, ROOT_PANE_ID, targetPaneId)

		const movedTab = useWorkspaceStore
			.getState()
			.panes[targetPaneId].tabs.find((candidate) => candidate.id === tab.id)
		expect(movedTab?.viewState).toEqual({ query: "ship" })
	})

	it("updates view state by tab id", () => {
		useWorkspaceStore.getState().openViewTab("emoji-browser", "Emoji")
		const tab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]

		useWorkspaceStore.getState().updateViewTabState(tab.id, ROOT_PANE_ID, { category: "recent" })

		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0].viewState).toEqual({
			category: "recent",
		})
	})

	it("updates view tab title and state together", () => {
		useWorkspaceStore.getState().openViewTab("plugin-markdown-note", "Welcome", {
			viewState: { content: "# Welcome" },
		})
		const tab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]

		useWorkspaceStore.getState().updateViewTab(tab.id, ROOT_PANE_ID, {
			title: "Updated welcome",
			viewState: { content: "# Updated" },
		})

		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]).toMatchObject({
			title: "Updated welcome",
			viewState: { content: "# Updated" },
		})
	})

	it("marks view tabs as ephemeral when requested", () => {
		useWorkspaceStore
			.getState()
			.openViewTab("app-update-changelog", "What's new", { ephemeral: true })

		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0].isEphemeral).toBe(true)
	})
})

describe("markTabDirty()", () => {
	it("marks a tab as dirty", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		const tab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]
		useWorkspaceStore.getState().markTabDirty(tab.id, true)
		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0].isDirty).toBe(true)
	})

	it("clears dirty flag", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		const tab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]
		useWorkspaceStore.getState().markTabDirty(tab.id, true)
		useWorkspaceStore.getState().markTabDirty(tab.id, false)
		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0].isDirty).toBe(false)
	})
})

describe("updateTabPath()", () => {
	it("updates the file path of a tab", () => {
		useWorkspaceStore.getState().openTab("/vault/old.md")
		useWorkspaceStore.getState().updateTabPath("/vault/old.md", "/vault/new.md")
		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs[0].filePath).toBe("/vault/new.md")
		expect(pane.tabs[0].title).toBe("new")
	})

	it("updates descendant tabs when a folder path changes", () => {
		useWorkspaceStore.getState().openTab("/vault/folder/note.md")
		useWorkspaceStore.getState().updateTabPath("/vault/folder", "/vault/archive")
		const pane = useWorkspaceStore.getState().panes[ROOT_PANE_ID]
		expect(pane.tabs[0].filePath).toBe("/vault/archive/note.md")
		expect(pane.tabs[0].title).toBe("note")
	})
})

describe("closeTabsByPath()", () => {
	it("closes descendant tabs when a folder path is closed", () => {
		useWorkspaceStore.getState().openTab("/vault/folder/one.md")
		useWorkspaceStore.getState().openTab("/vault/folder/two.md", { forceNew: true })
		useWorkspaceStore.getState().openTab("/vault/other.md", { forceNew: true })

		useWorkspaceStore.getState().closeTabsByPath("/vault/folder")

		expect(
			useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs.map((tab) => tab.filePath),
		).toEqual(["/vault/other.md"])
	})
})

describe("pinTab()", () => {
	it("toggles pinned state on a tab", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		const tab = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0]
		useWorkspaceStore.getState().pinTab(tab.id, ROOT_PANE_ID)
		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0].isPinned).toBe(true)
		useWorkspaceStore.getState().pinTab(tab.id, ROOT_PANE_ID)
		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs[0].isPinned).toBe(false)
	})
})

describe("workspace persistence", () => {
	it("persists left sidebar layout with workspace state", async () => {
		const writeFile = vi.fn().mockResolvedValue(undefined)
		vi.mocked(getPlatform).mockReturnValue({
			fs: { writeFile },
		} as never)
		useUIStore.getState().setLeftSidebarLayout({ collapsed: true, width: 320 })

		await useWorkspaceStore.getState().persistWorkspace("/vault")

		expect(writeFile).toHaveBeenCalledWith("/vault/.cortex/workspace.json", expect.any(String))
		expect(JSON.parse(writeFile.mock.calls[0][1])).toEqual(
			expect.objectContaining({
				leftSidebar: {
					collapsed: true,
					width: 320,
				},
			}),
		)
	})

	it("does not persist ephemeral tabs", async () => {
		const writeFile = vi.fn().mockResolvedValue(undefined)
		vi.mocked(getPlatform).mockReturnValue({
			fs: { writeFile },
		} as never)

		useWorkspaceStore.getState().openTab("/vault/note.md")
		useWorkspaceStore.getState().openViewTab("plugin-markdown-note", "Plugin guide", {
			ephemeral: true,
			viewState: {
				pluginId: "intro-plugin",
				id: "welcome",
				content: "# Plugin guide",
			},
		})

		await useWorkspaceStore.getState().persistWorkspace("/vault")

		const persisted = JSON.parse(writeFile.mock.calls[0][1])
		expect(persisted.panes[ROOT_PANE_ID].tabs).toHaveLength(1)
		expect(persisted.panes[ROOT_PANE_ID].tabs[0].filePath).toBe("/vault/note.md")
		expect(persisted.panes[ROOT_PANE_ID].tabs[0].viewId).toBeNull()
	})

	it("drops legacy ephemeral tabs while restoring workspace state", async () => {
		const readFile = vi.fn().mockResolvedValue(
			JSON.stringify({
				...buildInitial(),
				panes: {
					[ROOT_PANE_ID]: {
						id: ROOT_PANE_ID,
						activeTabId: "ephemeral",
						tabs: [
							{
								id: "ephemeral",
								tabType: "view",
								filePath: "",
								viewId: "app-update-changelog",
								viewState: { content: "# Changes" },
								title: "What's new",
								isPinned: false,
								isDirty: false,
								isEphemeral: true,
								lastAccessed: 1,
								isSuspended: false,
							},
						],
					},
				},
			}),
		)
		vi.mocked(getPlatform).mockReturnValue({
			fs: { readFile },
		} as never)

		await useWorkspaceStore.getState().loadWorkspace("/vault")

		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs).toHaveLength(0)
		expect(useWorkspaceStore.getState().panes[ROOT_PANE_ID].activeTabId).toBeNull()
	})

	it("restores hidden file tabs as suspended and opens only active file tabs", async () => {
		const readFile = vi.fn().mockResolvedValue(
			JSON.stringify({
				...buildInitial(),
				panes: {
					[ROOT_PANE_ID]: {
						id: ROOT_PANE_ID,
						activeTabId: "active",
						tabs: [
							{
								id: "hidden",
								tabType: "file",
								filePath: "/vault/hidden.md",
								viewId: null,
								viewState: null,
								title: "hidden",
								isPinned: false,
								isDirty: false,
								isEphemeral: false,
								lastAccessed: 1,
								isSuspended: false,
							},
							{
								id: "active",
								tabType: "file",
								filePath: "/vault/active.md",
								viewId: null,
								viewState: null,
								title: "active",
								isPinned: false,
								isDirty: false,
								isEphemeral: false,
								lastAccessed: 2,
								isSuspended: true,
							},
						],
					},
				},
			}),
		)
		vi.mocked(getPlatform).mockReturnValue({
			fs: { readFile },
		} as never)

		await useWorkspaceStore.getState().loadWorkspace("/vault")

		const tabs = useWorkspaceStore.getState().panes[ROOT_PANE_ID].tabs
		expect(tabs.find((tab) => tab.id === "hidden")?.isSuspended).toBe(true)
		expect(tabs.find((tab) => tab.id === "active")?.isSuspended).toBe(false)
		expect(noteCache.openTab).toHaveBeenCalledTimes(1)
		expect(noteCache.openTab).toHaveBeenCalledWith("/vault/active.md")
	})

	it("restores left sidebar layout from workspace state", async () => {
		const readFile = vi.fn().mockResolvedValue(
			JSON.stringify({
				...buildInitial(),
				leftSidebar: {
					collapsed: true,
					width: 360,
				},
			}),
		)
		vi.mocked(getPlatform).mockReturnValue({
			fs: { readFile },
		} as never)

		await useWorkspaceStore.getState().loadWorkspace("/vault")

		expect(useUIStore.getState().leftSidebarCollapsed).toBe(true)
		expect(useUIStore.getState().leftSidebarWidth).toBe(360)
	})

	it("uses default left sidebar layout for older workspace files", async () => {
		const readFile = vi.fn().mockResolvedValue(JSON.stringify(buildInitial()))
		vi.mocked(getPlatform).mockReturnValue({
			fs: { readFile },
		} as never)
		useUIStore.getState().setLeftSidebarLayout({ collapsed: true, width: 360 })

		await useWorkspaceStore.getState().loadWorkspace("/vault")

		expect(useUIStore.getState().leftSidebarCollapsed).toBe(false)
		expect(useUIStore.getState().leftSidebarWidth).toBe(240)
	})
})

describe("reset()", () => {
	it("resets workspace to initial state", () => {
		useWorkspaceStore.getState().openTab("/vault/note.md")
		useWorkspaceStore.getState().splitPane(ROOT_PANE_ID, "horizontal")
		useWorkspaceStore.getState().reset()
		const { panes, splitTree } = useWorkspaceStore.getState()
		expect(Object.keys(panes)).toHaveLength(1)
		expect(splitTree.type).toBe("leaf")
		expect(panes[ROOT_PANE_ID].tabs).toHaveLength(0)
	})
})
