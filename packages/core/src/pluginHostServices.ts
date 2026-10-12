import { type BookmarkEntry, useBookmarksStore } from "./stores/bookmarksStore"
import { useEditorStore } from "./stores/editorStore"
import { useTagsStore } from "./stores/tagsStore"
import { useVaultStore } from "./stores/vaultStore"
import { type OpenTabOptions, useWorkspaceStore } from "./stores/workspaceStore"
import { requireBookmarkPath } from "./utils/bookmarkPaths"
import { extractAllTags, parseFrontmatter } from "./utils/frontmatter"

export const PLUGIN_MARKDOWN_NOTE_VIEW_ID = "plugin-markdown-note"

type WorkspaceOpenTarget = "active" | "left" | "right" | "top" | "bottom"

interface WorkspaceOpenOptions {
	target?: WorkspaceOpenTarget
	newTab?: boolean
}

interface WorkspaceMarkdownTab {
	id?: string
	title: string
	content: string
}

const splitPlacements: Record<
	Exclude<WorkspaceOpenTarget, "active">,
	Required<Pick<OpenTabOptions, "split" | "splitPosition">>
> = {
	left: { split: "horizontal", splitPosition: "before" },
	right: { split: "horizontal", splitPosition: "after" },
	top: { split: "vertical", splitPosition: "before" },
	bottom: { split: "vertical", splitPosition: "after" },
}

export function getWorkspaceOpenTabOptions(options?: WorkspaceOpenOptions): OpenTabOptions {
	const target = options?.target ?? "active"
	const openTabOptions: OpenTabOptions = { forceNew: options?.newTab }
	if (target === "active") return openTabOptions
	return {
		...openTabOptions,
		paneId: useWorkspaceStore.getState().activePaneId,
		...splitPlacements[target],
	}
}

function findPluginMarkdownTab(pluginId: string, tabId: string) {
	for (const [paneId, pane] of Object.entries(useWorkspaceStore.getState().panes)) {
		const tab = pane.tabs.find(
			(candidate) =>
				candidate.tabType === "view" &&
				candidate.viewId === PLUGIN_MARKDOWN_NOTE_VIEW_ID &&
				candidate.viewState?.pluginId === pluginId &&
				candidate.viewState.id === tabId,
		)
		if (tab) return { tabId: tab.id, paneId }
	}
	return null
}

export function openPluginMarkdownTab(
	pluginId: string,
	tab: WorkspaceMarkdownTab,
	options?: WorkspaceOpenOptions,
): void {
	const viewState = { pluginId, id: tab.id ?? null, title: tab.title, content: tab.content }
	const existing = tab.id && !options?.newTab ? findPluginMarkdownTab(pluginId, tab.id) : null
	const workspace = useWorkspaceStore.getState()
	if (existing) {
		workspace.updateViewTab(existing.tabId, existing.paneId, { title: tab.title, viewState })
		workspace.activateTab(existing.tabId, existing.paneId)
		return
	}
	workspace.openViewTab(PLUGIN_MARKDOWN_NOTE_VIEW_ID, tab.title, {
		...getWorkspaceOpenTabOptions(options),
		forceNew: true,
		ephemeral: true,
		viewState,
	})
}

function withBookmarkPath<T>(path: string, run: (vaultPath: string, bookmarkPath: string) => T): T {
	const { vaultPath, bookmarkPath } = requireBookmarkPath(
		useVaultStore.getState().vault?.path,
		path,
	)
	return run(vaultPath, bookmarkPath)
}

/**
 * Plugin host services backed by core stores. Hosts spread this into `createPluginHost({...})`,
 * complete `activeEditor` from its `getFilePath`, and add their platform services (editor runtime,
 * theme, community loading).
 */
export function createCoreServices() {
	return {
		getVaultPath: () => useVaultStore.getState().vault?.path ?? null,
		workspace: {
			openFile(path: string, options?: WorkspaceOpenOptions) {
				useWorkspaceStore.getState().openTab(path, getWorkspaceOpenTabOptions(options))
			},
			openView(viewKey: string, label: string, options?: WorkspaceOpenOptions) {
				useWorkspaceStore
					.getState()
					.openViewTab(viewKey, label, getWorkspaceOpenTabOptions(options))
			},
			openMarkdownTab: openPluginMarkdownTab,
			getOpenFiles: () =>
				Object.values(useWorkspaceStore.getState().panes).flatMap((pane) =>
					pane.tabs.flatMap((tab) => (tab.tabType === "file" ? [tab.filePath] : [])),
				),
			subscribeActiveFile: (callback: (path: string | null) => void) =>
				useEditorStore.subscribe((state, previousState) => {
					if (state.activeFilePath !== previousState.activeFilePath) {
						callback(state.activeFilePath)
					}
				}),
		},
		activeEditor: {
			getFilePath: () => useEditorStore.getState().activeFilePath,
		},
		bookmarks: {
			list: () => useBookmarksStore.getState().bookmarks,
			add: (path: string) =>
				withBookmarkPath(path, (vaultPath, bookmarkPath) =>
					useBookmarksStore.getState().addBookmark(vaultPath, bookmarkPath),
				),
			remove: (path: string) =>
				withBookmarkPath(path, (vaultPath, bookmarkPath) =>
					useBookmarksStore.getState().removeBookmark(vaultPath, bookmarkPath),
				),
			toggle: (path: string, force?: boolean) =>
				withBookmarkPath(path, (vaultPath, bookmarkPath) =>
					useBookmarksStore.getState().toggleBookmark(vaultPath, bookmarkPath, force),
				),
			isBookmarked: (path: string) =>
				withBookmarkPath(path, (vaultPath, bookmarkPath) =>
					useBookmarksStore.getState().isBookmarked(vaultPath, bookmarkPath),
				),
			subscribe: (callback: (bookmarks: BookmarkEntry[]) => void) =>
				useBookmarksStore.subscribe((state, previousState) => {
					if (state.bookmarks !== previousState.bookmarks) callback(state.bookmarks)
				}),
		},
		metadata: {
			parseFrontmatter: (content: string) =>
				parseFrontmatter(content).frontmatter as Record<string, unknown> | null,
			extractTags: extractAllTags,
			getAllTags: () =>
				useTagsStore
					.getState()
					.getAllTags()
					.map((entry) => ({ tag: entry.tag, count: entry.filePaths.length })),
		},
	}
}
