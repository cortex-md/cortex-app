import { getPlatform } from "@cortex/platform"
import {
	getNoteTitle,
	getVaultFilePath,
	isPathOrDescendant,
	isPdfPath,
	replacePathPrefix,
	VAULT_FILES,
} from "@cortex/platform/utils"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { noteCache } from "../noteCache"
import {
	EMPTY_NAVIGATION_HISTORY,
	type NavigationDirection,
	type NavigationHistory,
	type NavigationLocation,
	pushNavigationLocation,
	renameNavigationLocations,
	stepNavigationHistory,
} from "../utils/navigationHistory"
import { type LeftSidebarLayout, type RightSidebarLayout, useUIStore } from "./uiStore"

export type SplitDirection = "horizontal" | "vertical"
export type TabType = "file" | "view"
export type FileTabKind = "markdown" | "pdf"
export type ViewTabState = Record<string, unknown>

export interface Tab {
	id: string
	tabType: TabType
	fileKind: FileTabKind | null
	filePath: string
	viewId: string | null
	viewState: ViewTabState | null
	title: string
	isPinned: boolean
	isDirty: boolean
	isEphemeral: boolean
	lastAccessed: number
	isSuspended: boolean
}

function getTabResourcePath(tab: Tab): string | null {
	if (tab.tabType !== "view") return tab.filePath
	const filePath = tab.viewState?.filePath
	return typeof filePath === "string" && filePath ? filePath : null
}

export interface LeafNode {
	type: "leaf"
	id: string
}

export interface SplitNode {
	type: "split"
	id: string
	direction: SplitDirection
	children: SplitTree[]
	sizes: number[]
}

export type SplitTree = LeafNode | SplitNode

export interface Pane {
	id: string
	tabs: Tab[]
	activeTabId: string | null
}

export interface RecentlyClosed {
	filePath: string
	title: string
}

interface WorkspaceSnapshot {
	panes: Record<string, Pane>
	splitTree: SplitTree
	activePaneId: string
	leftSidebar?: Partial<LeftSidebarLayout>
	rightSidebar?: Partial<RightSidebarLayout>
	quickFinderPreview?: boolean
	recentCommandIds?: string[]
}

export interface OpenTabOptions {
	paneId?: string
	split?: SplitDirection
	splitPosition?: "before" | "after"
	forceNew?: boolean
	newTab?: boolean
	reuseActive?: boolean
	insertIndex?: number
	viewState?: ViewTabState
	ephemeral?: boolean
}

export interface WorkspaceState {
	panes: Record<string, Pane>
	splitTree: SplitTree
	activePaneId: string
	mruOrder: string[]
	recentlyClosed: RecentlyClosed[]
	navigation: Record<string, NavigationHistory>

	openTab: (filePath: string, opts?: OpenTabOptions) => void
	openViewTab: (viewId: string, title: string, opts?: OpenTabOptions) => void
	openInSplit: (filePath: string, paneId: string, direction: SplitDirection) => void
	closeTab: (tabId: string, paneId: string) => void
	closeTabsByPath: (filePath: string) => void
	closeOtherTabs: (tabId: string, paneId: string, scope?: "others" | "right") => void
	navigateHistory: (paneId: string, direction: NavigationDirection) => void
	updateTabPath: (oldPath: string, newPath: string) => void
	activateTab: (tabId: string, paneId: string) => void
	pinTab: (tabId: string, paneId: string) => void
	markTabDirty: (tabId: string, dirty: boolean) => void
	updateViewTab: (
		tabId: string,
		paneId: string,
		updates: { title?: string; viewState?: ViewTabState },
	) => void
	updateTabViewState: (tabId: string, paneId: string, viewState: ViewTabState) => void
	updateViewTabState: (tabId: string, paneId: string, viewState: ViewTabState) => void
	splitPane: (paneId: string, direction: SplitDirection, position?: "before" | "after") => void
	closePane: (paneId: string) => void
	resizeSplit: (nodeId: string, sizes: number[]) => void
	moveTab: (tabId: string, fromPaneId: string, toPaneId: string, insertIndex?: number) => void
	moveTabToNewSplit: (
		tabId: string,
		fromPaneId: string,
		targetPaneId: string,
		direction: SplitDirection,
		position: "before" | "after",
	) => void
	goToTabIndex: (index: number) => void
	navigateMRU: (delta: 1 | -1) => void
	reopenLastClosed: () => void
	suspendInactiveTabs: () => void
	persistWorkspace: (vaultPath: string) => Promise<void>
	loadWorkspace: (vaultPath: string) => Promise<void>
	reset: () => void
}

const ROOT_PANE_ID = "root"
const MAX_RECENT_CLOSED = 10
const SUSPENSION_IDLE_MS = 30 * 60 * 1000

export function inferFileTabKind(filePath: string): FileTabKind {
	return isPdfPath(filePath) ? "pdf" : "markdown"
}

export function getRecentFilePaths(
	panes: Record<string, Pane>,
	recentlyClosed: readonly RecentlyClosed[],
	limit = 15,
): string[] {
	const openTabs = Object.values(panes)
		.flatMap((pane) => pane.tabs)
		.filter((tab) => tab.tabType === "file" && tab.filePath)
		.sort((a, b) => b.lastAccessed - a.lastAccessed)
	const paths = new Set<string>()
	for (const tab of openTabs) paths.add(tab.filePath)
	for (const closed of recentlyClosed) paths.add(closed.filePath)
	return Array.from(paths).slice(0, limit)
}

function getFileTabKind(tab: Pick<Tab, "tabType" | "fileKind" | "filePath">): FileTabKind | null {
	if (tab.tabType !== "file") return null
	return tab.fileKind ?? inferFileTabKind(tab.filePath)
}

function isMarkdownFileTab(tab: Tab): boolean {
	return getFileTabKind(tab) === "markdown" && tab.filePath.length > 0
}

function replaceInTree(tree: SplitTree, targetId: string, replacement: SplitTree): SplitTree {
	if (tree.id === targetId) return replacement
	if (tree.type === "leaf") return tree
	return { ...tree, children: tree.children.map((c) => replaceInTree(c, targetId, replacement)) }
}

function removeFromTree(tree: SplitTree, targetId: string): SplitTree | null {
	if (tree.id === targetId) return null
	if (tree.type === "leaf") return tree
	const newChildren = tree.children
		.map((c) => removeFromTree(c, targetId))
		.filter((c): c is SplitTree => c !== null)
	if (newChildren.length === 0) return null
	if (newChildren.length === 1) return newChildren[0]
	return {
		...tree,
		children: newChildren,
		sizes: newChildren.map(() => 100 / newChildren.length),
	}
}

function findTabInPanes(
	panes: Record<string, Pane>,
	filePath: string,
): { tabId: string; paneId: string } | null {
	for (const [paneId, pane] of Object.entries(panes)) {
		for (const tab of pane.tabs) {
			if (tab.tabType === "file" && tab.filePath === filePath) {
				return { tabId: tab.id, paneId }
			}
		}
	}
	return null
}

function findViewTabInPanes(
	panes: Record<string, Pane>,
	viewId: string,
): { tabId: string; paneId: string } | null {
	for (const [paneId, pane] of Object.entries(panes)) {
		for (const tab of pane.tabs) {
			if (tab.tabType === "view" && tab.viewId === viewId) {
				return { tabId: tab.id, paneId }
			}
		}
	}
	return null
}

function findTabPane(panes: Record<string, Pane>, tabId: string): string | null {
	for (const [paneId, pane] of Object.entries(panes)) {
		if (pane.tabs.some((t) => t.id === tabId)) return paneId
	}
	return null
}

function findReusableActiveFileTab(panes: Record<string, Pane>, paneId: string): Tab | null {
	const pane = panes[paneId]
	if (!pane?.activeTabId) return null
	const tab = pane.tabs.find((candidate) => candidate.id === pane.activeTabId)
	if (!tab || tab.tabType !== "file" || tab.isPinned) return null
	return tab
}

const buildInitialState = () => ({
	panes: {
		[ROOT_PANE_ID]: { id: ROOT_PANE_ID, tabs: [], activeTabId: null },
	} as Record<string, Pane>,
	splitTree: { type: "leaf", id: ROOT_PANE_ID } as SplitTree,
	activePaneId: ROOT_PANE_ID,
	mruOrder: [] as string[],
	recentlyClosed: [] as RecentlyClosed[],
	navigation: {} as Record<string, NavigationHistory>,
})

let restoringNavigation = false

function toNavigationLocation(tab: Tab): NavigationLocation {
	return {
		tabType: tab.tabType,
		filePath: tab.filePath,
		viewId: tab.viewId,
		viewState: tab.viewState,
		title: tab.title,
	}
}

function recordNavigation(state: WorkspaceState, paneId: string): void {
	if (restoringNavigation) return
	const pane = state.panes[paneId]
	const tab = pane?.tabs.find((candidate) => candidate.id === pane.activeTabId)
	if (!tab || tab.isEphemeral) return
	state.navigation[paneId] = pushNavigationLocation(
		state.navigation[paneId] ?? EMPTY_NAVIGATION_HISTORY,
		toNavigationLocation(tab),
	)
}

function findPaneTabForLocation(pane: Pane, location: NavigationLocation): Tab | undefined {
	return pane.tabs.find((tab) =>
		location.tabType === "file"
			? tab.tabType === "file" && tab.filePath === location.filePath
			: tab.tabType === "view" && tab.viewId === location.viewId,
	)
}

function insertTabAt(pane: Pane, tab: Tab, insertIndex?: number): void {
	const index = insertIndex === undefined ? pane.tabs.length : Math.max(0, insertIndex)
	pane.tabs.splice(Math.min(index, pane.tabs.length), 0, tab)
}

function createPersistedPane(pane: Pane): Pane {
	const tabs = pane.tabs
		.filter((tab) => !tab.isEphemeral)
		.map((tab) => ({
			...tab,
			fileKind: getFileTabKind(tab),
		}))
	const activeTabId = tabs.some((tab) => tab.id === pane.activeTabId)
		? pane.activeTabId
		: (tabs.at(-1)?.id ?? null)
	return {
		...pane,
		tabs,
		activeTabId,
	}
}

function normalizeLoadedPane(pane: Pane): Pane {
	const tabs: Tab[] = []
	for (const tab of pane.tabs) {
		if (tab.isEphemeral) continue
		const tabType = tab.tabType ?? "file"
		tabs.push({
			...tab,
			tabType,
			fileKind: getFileTabKind({ ...tab, tabType }),
			viewId: tab.viewId ?? null,
			viewState: tab.viewState ?? null,
			isEphemeral: false,
			isSuspended: tab.isSuspended ?? false,
		})
	}
	const activeTabId = tabs.some((tab) => tab.id === pane.activeTabId)
		? pane.activeTabId
		: (tabs.at(-1)?.id ?? null)
	for (const tab of tabs) {
		if (tab.tabType === "file") tab.isSuspended = tab.id !== activeTabId
	}
	return {
		...pane,
		tabs,
		activeTabId,
	}
}

function openActiveFileTabs(panes: Record<string, Pane>): void {
	for (const pane of Object.values(panes)) {
		const activeTab = pane.tabs.find((tab) => tab.id === pane.activeTabId)
		if (activeTab && isMarkdownFileTab(activeTab) && !activeTab.isSuspended) {
			noteCache.openTab(activeTab.filePath)
		}
	}
}

export const useWorkspaceStore = create<WorkspaceState>()(
	devtools(
		immer((set, get) => ({
			...buildInitialState(),

			openTab: (filePath, opts) => {
				const { panes, activePaneId } = get()
				const fileKind = inferFileTabKind(filePath)

				const shouldForceNewTab = opts?.forceNew ?? opts?.newTab ?? false
				const existing = shouldForceNewTab ? null : findTabInPanes(panes, filePath)
				if (existing) {
					get().activateTab(existing.tabId, existing.paneId)
					return
				}

				let targetPaneId = opts?.paneId ?? activePaneId

				if (opts?.split) {
					get().splitPane(targetPaneId, opts.split, opts.splitPosition)
					targetPaneId = get().activePaneId
				}

				const reusableTab =
					opts?.reuseActive && !shouldForceNewTab && !opts?.split
						? findReusableActiveFileTab(panes, targetPaneId)
						: null
				if (reusableTab) {
					const previousFilePath = reusableTab.filePath
					const previousFileKind = getFileTabKind(reusableTab)
					if (fileKind === "markdown") noteCache.openTab(filePath)
					if (previousFileKind === "markdown") void noteCache.closeTab(previousFilePath)

					set((s) => {
						const pane = s.panes[targetPaneId]
						const tab = pane?.tabs.find((candidate) => candidate.id === reusableTab.id)
						if (!pane || !tab || tab.tabType !== "file" || tab.isPinned) return
						tab.fileKind = fileKind
						tab.filePath = filePath
						tab.viewId = null
						tab.viewState = null
						tab.title = getNoteTitle(filePath)
						tab.isDirty = false
						tab.isEphemeral = opts?.ephemeral ?? false
						tab.lastAccessed = Date.now()
						tab.isSuspended = false
						pane.activeTabId = tab.id
						s.activePaneId = targetPaneId
						s.mruOrder = [tab.id, ...s.mruOrder.filter((id) => id !== tab.id)]
						recordNavigation(s, targetPaneId)
					})
					return
				}

				const tabId = crypto.randomUUID()
				const tab: Tab = {
					id: tabId,
					tabType: "file",
					fileKind,
					filePath,
					viewId: null,
					viewState: null,
					title: getNoteTitle(filePath),
					isPinned: false,
					isDirty: false,
					isEphemeral: opts?.ephemeral ?? false,
					lastAccessed: Date.now(),
					isSuspended: false,
				}

				if (fileKind === "markdown") noteCache.openTab(filePath)

				set((s) => {
					const pane = s.panes[targetPaneId]
					if (!pane) return
					insertTabAt(pane, tab, opts?.insertIndex)
					pane.activeTabId = tabId
					s.activePaneId = targetPaneId
					s.mruOrder = [tabId, ...s.mruOrder.filter((id) => id !== tabId)]
					recordNavigation(s, targetPaneId)
				})
			},

			openViewTab: (viewId, title, opts) => {
				const { panes, activePaneId } = get()

				const shouldForceNewTab = opts?.forceNew ?? opts?.newTab ?? false
				const existing = shouldForceNewTab ? null : findViewTabInPanes(panes, viewId)
				if (existing) {
					get().activateTab(existing.tabId, existing.paneId)
					return
				}

				let targetPaneId = opts?.paneId ?? activePaneId

				if (opts?.split) {
					get().splitPane(targetPaneId, opts.split, opts.splitPosition)
					targetPaneId = get().activePaneId
				}

				const tabId = crypto.randomUUID()
				const tab: Tab = {
					id: tabId,
					tabType: "view",
					fileKind: null,
					filePath: "",
					viewId,
					viewState: opts?.viewState ?? null,
					title,
					isPinned: false,
					isDirty: false,
					isEphemeral: opts?.ephemeral ?? false,
					lastAccessed: Date.now(),
					isSuspended: false,
				}

				set((s) => {
					const pane = s.panes[targetPaneId]
					if (!pane) return
					insertTabAt(pane, tab, opts?.insertIndex)
					pane.activeTabId = tabId
					s.activePaneId = targetPaneId
					s.mruOrder = [tabId, ...s.mruOrder.filter((id) => id !== tabId)]
					recordNavigation(s, targetPaneId)
				})
			},

			openInSplit: (filePath, paneId, direction) => {
				get().splitPane(paneId, direction)
				const newPaneId = get().activePaneId
				const fileKind = inferFileTabKind(filePath)

				const tabId = crypto.randomUUID()
				const tab: Tab = {
					id: tabId,
					tabType: "file",
					fileKind,
					filePath,
					viewId: null,
					viewState: null,
					title: getNoteTitle(filePath),
					isPinned: false,
					isDirty: false,
					isEphemeral: false,
					lastAccessed: Date.now(),
					isSuspended: false,
				}

				if (fileKind === "markdown") noteCache.openTab(filePath)

				set((s) => {
					const pane = s.panes[newPaneId]
					if (!pane) return
					pane.tabs.push(tab)
					pane.activeTabId = tabId
					s.mruOrder = [tabId, ...s.mruOrder.filter((id) => id !== tabId)]
					recordNavigation(s, newPaneId)
				})
			},

			closeTab: (tabId, paneId) => {
				const { panes, mruOrder, recentlyClosed } = get()
				const pane = panes[paneId]
				if (!pane) return
				const tab = pane.tabs.find((t) => t.id === tabId)
				if (!tab || tab.isPinned) return

				const tabIndex = pane.tabs.indexOf(tab)
				const remainingTabs = pane.tabs.filter((t) => t.id !== tabId)

				let nextTabId: string | null = null
				if (pane.activeTabId === tabId) {
					const paneMruTabs = mruOrder.filter(
						(id) => id !== tabId && remainingTabs.some((t) => t.id === id),
					)
					nextTabId =
						paneMruTabs[0] ??
						remainingTabs[Math.min(tabIndex, remainingTabs.length - 1)]?.id ??
						null
				}

				if (isMarkdownFileTab(tab) && !tab.isSuspended) {
					void noteCache.closeTab(tab.filePath)
				}

				set((s) => {
					const p = s.panes[paneId]
					if (!p) return
					p.tabs = p.tabs.filter((t) => t.id !== tabId)
					p.activeTabId = nextTabId
					s.mruOrder = mruOrder.filter((id) => id !== tabId)
					if (tab.tabType === "file" && tab.filePath && !tab.isEphemeral) {
						s.recentlyClosed = [
							{ filePath: tab.filePath, title: tab.title },
							...recentlyClosed.slice(0, MAX_RECENT_CLOSED - 1),
						]
					}
				})

				if (remainingTabs.length === 0 && Object.keys(get().panes).length > 1) {
					get().closePane(paneId)
				}
			},

			closeTabsByPath: (filePath) => {
				const { panes } = get()
				for (const [paneId, pane] of Object.entries(panes)) {
					const matchingTabs = pane.tabs.filter((t) => {
						const tabPath = getTabResourcePath(t)
						return tabPath !== null && isPathOrDescendant(tabPath, filePath)
					})
					for (const tab of matchingTabs) {
						get().closeTab(tab.id, paneId)
					}
				}
			},

			closeOtherTabs: (tabId, paneId, scope = "others") => {
				const tabs = get().panes[paneId]?.tabs ?? []
				const targetIndex = tabs.findIndex((tab) => tab.id === tabId)
				if (targetIndex === -1) return
				const closable = tabs.filter(
					(tab, index) =>
						!tab.isPinned && tab.id !== tabId && (scope === "others" || index > targetIndex),
				)
				for (const tab of closable) get().closeTab(tab.id, paneId)
			},

			navigateHistory: (paneId, direction) => {
				const history = get().navigation[paneId]
				const step = history ? stepNavigationHistory(history, direction) : null
				const pane = get().panes[paneId]
				if (!step || !pane) return
				const { location } = step
				restoringNavigation = true
				try {
					const existing = findPaneTabForLocation(pane, location)
					if (existing) {
						get().activateTab(existing.id, paneId)
					} else if (location.tabType === "file") {
						get().openTab(location.filePath, { paneId, reuseActive: true })
					} else if (location.viewId) {
						get().openViewTab(location.viewId, location.title, {
							paneId,
							viewState: location.viewState ?? undefined,
						})
					}
				} finally {
					restoringNavigation = false
				}
				set((s) => {
					s.navigation[paneId] = step.history
				})
			},

			updateTabPath: (oldPath, newPath) => {
				set((s) => {
					for (const [paneId, history] of Object.entries(s.navigation)) {
						s.navigation[paneId] = renameNavigationLocations(history, (filePath) =>
							replacePathPrefix(filePath, oldPath, newPath),
						)
					}
					for (const pane of Object.values(s.panes)) {
						for (const tab of pane.tabs) {
							if (tab.tabType === "view") {
								if (!tab.viewState) continue
								const viewPath = getTabResourcePath(tab)
								for (const [key, value] of Object.entries(tab.viewState)) {
									if (typeof value !== "string" || !value) continue
									const nextValue = replacePathPrefix(value, oldPath, newPath)
									if (nextValue) tab.viewState[key] = nextValue
								}
								const nextViewPath = getTabResourcePath(tab)
								if (viewPath && nextViewPath && tab.title === getNoteTitle(viewPath)) {
									tab.title = getNoteTitle(nextViewPath)
								}
								continue
							}
							const nextPath = replacePathPrefix(tab.filePath, oldPath, newPath)
							if (!nextPath) continue
							tab.filePath = nextPath
							tab.fileKind = inferFileTabKind(nextPath)
							tab.title = getNoteTitle(nextPath)
						}
					}
				})
			},

			activateTab: (tabId, paneId) => {
				const tabToActivate = get().panes[paneId]?.tabs.find((tab) => tab.id === tabId)
				if (tabToActivate && isMarkdownFileTab(tabToActivate) && tabToActivate.isSuspended) {
					noteCache.openTab(tabToActivate.filePath)
				}

				set((s) => {
					const pane = s.panes[paneId]
					if (!pane) return
					const tab = pane.tabs.find((t) => t.id === tabId)
					if (!tab) return
					pane.activeTabId = tabId
					tab.fileKind = getFileTabKind(tab)
					tab.lastAccessed = Date.now()
					tab.isSuspended = false
					s.activePaneId = paneId
					s.mruOrder = [tabId, ...s.mruOrder.filter((id) => id !== tabId)]
					recordNavigation(s, paneId)
				})
			},

			pinTab: (tabId, paneId) => {
				set((s) => {
					const tab = s.panes[paneId]?.tabs.find((t) => t.id === tabId)
					if (tab) tab.isPinned = !tab.isPinned
				})
			},

			markTabDirty: (tabId, dirty) => {
				set((s) => {
					for (const pane of Object.values(s.panes)) {
						for (const tab of pane.tabs) {
							if (tab.id === tabId) {
								if (tab.isDirty === dirty) return
								tab.isDirty = dirty
								return
							}
						}
					}
				})
			},

			updateViewTab: (tabId, paneId, updates) => {
				set((s) => {
					const tab = s.panes[paneId]?.tabs.find((t) => t.id === tabId)
					if (tab?.tabType !== "view") return
					if (updates.title !== undefined) tab.title = updates.title
					if (updates.viewState !== undefined) tab.viewState = updates.viewState
				})
			},

			updateTabViewState: (tabId, paneId, viewState) => {
				set((s) => {
					const tab = s.panes[paneId]?.tabs.find((t) => t.id === tabId)
					if (tab) tab.viewState = viewState
				})
			},

			updateViewTabState: (tabId, paneId, viewState) => {
				set((s) => {
					const tab = s.panes[paneId]?.tabs.find((t) => t.id === tabId)
					if (tab?.tabType === "view") tab.viewState = viewState
				})
			},

			splitPane: (paneId, direction, position) => {
				const newPaneId = crypto.randomUUID()
				const splitNodeId = crypto.randomUUID()

				const children: SplitTree[] =
					position === "before"
						? [
								{ type: "leaf", id: newPaneId },
								{ type: "leaf", id: paneId },
							]
						: [
								{ type: "leaf", id: paneId },
								{ type: "leaf", id: newPaneId },
							]

				set((s) => {
					s.panes[newPaneId] = { id: newPaneId, tabs: [], activeTabId: null }
					s.splitTree = replaceInTree(s.splitTree, paneId, {
						type: "split",
						id: splitNodeId,
						direction,
						children,
						sizes: [50, 50],
					})
					s.activePaneId = newPaneId
				})
			},

			closePane: (paneId) => {
				const { panes, splitTree, activePaneId, mruOrder } = get()
				if (Object.keys(panes).length <= 1) return

				const pane = panes[paneId]
				if (!pane) return

				const otherPaneId = Object.keys(panes).find((id) => id !== paneId)

				for (const tab of pane.tabs) {
					if (!isMarkdownFileTab(tab)) continue
					if (!tab.isSuspended) void noteCache.closeTab(tab.filePath)
				}

				const newTree = removeFromTree(splitTree, paneId) ?? {
					type: "leaf" as const,
					id: otherPaneId ?? ROOT_PANE_ID,
				}

				const closedTabIds = new Set(pane.tabs.map((t) => t.id))

				set((s) => {
					delete s.panes[paneId]
					delete s.navigation[paneId]
					s.splitTree = newTree
					if (activePaneId === paneId) {
						s.activePaneId = otherPaneId ?? ROOT_PANE_ID
					}
					s.mruOrder = mruOrder.filter((id) => !closedTabIds.has(id))
				})
			},

			resizeSplit: (nodeId, sizes) => {
				const updateSizes = (tree: SplitTree): SplitTree => {
					if (tree.type === "leaf") return tree
					if (tree.id === nodeId) return { ...tree, sizes }
					return { ...tree, children: tree.children.map(updateSizes) }
				}
				set((s) => {
					s.splitTree = updateSizes(s.splitTree)
				})
			},

			moveTab: (tabId, fromPaneId, toPaneId, insertIndex) => {
				const { panes } = get()
				const fromPane = panes[fromPaneId]
				if (!fromPane) return
				const sourceIndex = fromPane.tabs.findIndex((t) => t.id === tabId)
				const tab = fromPane.tabs[sourceIndex]
				if (!tab) return

				const tabCopy = { ...tab, fileKind: getFileTabKind(tab), lastAccessed: Date.now() }
				const targetIndex =
					fromPaneId === toPaneId && insertIndex !== undefined && sourceIndex < insertIndex
						? insertIndex - 1
						: insertIndex

				set((s) => {
					const from = s.panes[fromPaneId]
					const to = s.panes[toPaneId]
					if (!from || !to) return
					from.tabs = from.tabs.filter((t) => t.id !== tabId)
					if (from.activeTabId === tabId) {
						from.activeTabId = from.tabs[from.tabs.length - 1]?.id ?? null
					}
					insertTabAt(to, tabCopy, targetIndex)
					to.activeTabId = tabId
					s.activePaneId = toPaneId
				})

				const updatedFromPane = get().panes[fromPaneId]
				if (updatedFromPane && updatedFromPane.tabs.length === 0) {
					if (Object.keys(get().panes).length > 1) {
						get().closePane(fromPaneId)
					}
				}
			},

			moveTabToNewSplit: (tabId, fromPaneId, targetPaneId, direction, position) => {
				const { panes } = get()
				const fromPane = panes[fromPaneId]
				if (!fromPane) return
				const tab = fromPane.tabs.find((t) => t.id === tabId)
				if (!tab) return

				const newPaneId = crypto.randomUUID()
				const splitNodeId = crypto.randomUUID()
				const tabCopy = { ...tab, fileKind: getFileTabKind(tab), lastAccessed: Date.now() }

				set((s) => {
					const from = s.panes[fromPaneId]
					if (!from) return
					from.tabs = from.tabs.filter((t) => t.id !== tabId)
					if (from.activeTabId === tabId) {
						from.activeTabId = from.tabs[from.tabs.length - 1]?.id ?? null
					}

					s.panes[newPaneId] = {
						id: newPaneId,
						tabs: [tabCopy],
						activeTabId: tabId,
					}

					const children: SplitTree[] =
						position === "before"
							? [
									{ type: "leaf", id: newPaneId },
									{ type: "leaf", id: targetPaneId },
								]
							: [
									{ type: "leaf", id: targetPaneId },
									{ type: "leaf", id: newPaneId },
								]

					s.splitTree = replaceInTree(s.splitTree, targetPaneId, {
						type: "split",
						id: splitNodeId,
						direction,
						children,
						sizes: [50, 50],
					})
					s.activePaneId = newPaneId
				})

				const updatedFromPane = get().panes[fromPaneId]
				if (fromPaneId !== targetPaneId && updatedFromPane && updatedFromPane.tabs.length === 0) {
					if (Object.keys(get().panes).length > 1) {
						get().closePane(fromPaneId)
					}
				}
			},

			goToTabIndex: (index) => {
				const { panes, activePaneId } = get()
				const pane = panes[activePaneId]
				if (!pane) return
				const tab = pane.tabs[index]
				if (tab) get().activateTab(tab.id, activePaneId)
			},

			navigateMRU: (delta) => {
				const { mruOrder, panes, activePaneId } = get()
				if (mruOrder.length === 0) return
				const pane = panes[activePaneId]
				if (!pane?.activeTabId) return
				const currentIdx = mruOrder.indexOf(pane.activeTabId)
				const nextIdx = (currentIdx + delta + mruOrder.length) % mruOrder.length
				const nextTabId = mruOrder[nextIdx]
				const nextPaneId = findTabPane(panes, nextTabId)
				if (nextTabId && nextPaneId) get().activateTab(nextTabId, nextPaneId)
			},

			reopenLastClosed: () => {
				const { recentlyClosed } = get()
				if (recentlyClosed.length === 0) return
				const last = recentlyClosed[0]
				set((s) => {
					s.recentlyClosed = s.recentlyClosed.slice(1)
				})
				get().openTab(last.filePath)
			},

			suspendInactiveTabs: () => {
				const now = Date.now()
				const filePathsToRelease: string[] = []
				set((s) => {
					for (const pane of Object.values(s.panes)) {
						for (const tab of pane.tabs) {
							if (tab.tabType === "file" && tab.id !== pane.activeTabId && !tab.isSuspended) {
								if (now - tab.lastAccessed > SUSPENSION_IDLE_MS) {
									if (isMarkdownFileTab(tab)) filePathsToRelease.push(tab.filePath)
									tab.isSuspended = true
								}
							}
						}
					}
				})
				for (const filePath of filePathsToRelease) {
					void noteCache.closeTab(filePath)
				}
			},

			persistWorkspace: async (vaultPath) => {
				const { panes, splitTree, activePaneId } = get()
				const {
					leftSidebarCollapsed,
					leftSidebarWidth,
					rightSidebarCollapsed,
					rightSidebarPanel,
					quickFinderPreview,
					recentCommandIds,
				} = useUIStore.getState()
				const platform = getPlatform()
				const configPath = getVaultFilePath(vaultPath, VAULT_FILES.workspace)
				const persistedPanes = Object.fromEntries(
					Object.entries(panes).map(([paneId, pane]) => [paneId, createPersistedPane(pane)]),
				)
				await platform.fs.atomicWriteFile(
					configPath,
					JSON.stringify(
						{
							panes: persistedPanes,
							splitTree,
							activePaneId: persistedPanes[activePaneId] ? activePaneId : ROOT_PANE_ID,
							leftSidebar: {
								collapsed: leftSidebarCollapsed,
								width: leftSidebarWidth,
							},
							rightSidebar: {
								collapsed: rightSidebarCollapsed,
								panel: rightSidebarPanel,
							},
							quickFinderPreview,
							recentCommandIds,
						},
						null,
						2,
					),
				)
			},

			loadWorkspace: async (vaultPath) => {
				const platform = getPlatform()
				const configPath = getVaultFilePath(vaultPath, VAULT_FILES.workspace)
				try {
					const raw = await platform.fs.readFile(configPath)
					const data = JSON.parse(raw) as WorkspaceSnapshot
					if (data.panes && data.splitTree) {
						for (const pane of Object.values(data.panes)) {
							for (const tab of pane.tabs) {
								if (!tab.tabType) tab.tabType = "file"
								if (tab.fileKind === undefined) {
									tab.fileKind = tab.tabType === "file" ? inferFileTabKind(tab.filePath) : null
								}
								if (tab.viewId === undefined) tab.viewId = null
								if (tab.viewState === undefined) tab.viewState = null
								if (tab.isEphemeral === undefined) tab.isEphemeral = false
								if (tab.isSuspended === undefined) tab.isSuspended = false
							}
						}
						const panes = Object.fromEntries(
							Object.entries(data.panes).map(([paneId, pane]) => [
								paneId,
								normalizeLoadedPane(pane),
							]),
						)
						openActiveFileTabs(panes)
						set((s) => {
							s.panes = panes
							s.splitTree = data.splitTree
							s.activePaneId = panes[data.activePaneId] ? data.activePaneId : ROOT_PANE_ID
						})
					}
					if (data.leftSidebar) {
						useUIStore.getState().setLeftSidebarLayout(data.leftSidebar)
					} else {
						useUIStore.getState().resetLeftSidebarLayout()
					}
					if (data.rightSidebar) useUIStore.getState().setRightSidebarLayout(data.rightSidebar)
					if (typeof data.quickFinderPreview === "boolean") {
						useUIStore.getState().setQuickFinderPreview(data.quickFinderPreview)
					}
					useUIStore.getState().setRecentCommandIds(data.recentCommandIds)
				} catch {
					useUIStore.getState().resetLeftSidebarLayout()
					useUIStore.getState().setRecentCommandIds([])
				}
			},

			reset: () => {
				set((s) => {
					Object.assign(s, buildInitialState())
				})
			},
		})),
		{ name: "workspaceStore" },
	),
)

export function selectActiveTab(
	state: Pick<WorkspaceState, "panes" | "activePaneId">,
): Tab | undefined {
	const activePane = state.panes[state.activePaneId]
	return activePane?.tabs.find((tab) => tab.id === activePane.activeTabId)
}

export function selectActiveTabFilePath(
	state: Pick<WorkspaceState, "panes" | "activePaneId">,
): string | undefined {
	return selectActiveTab(state)?.filePath
}
