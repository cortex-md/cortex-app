import { type OpenTabOptions, useWorkspaceStore } from "@cortex/core"
import type { setWorkspaceFunctions } from "@cortex/plugin-host-core"
import { PLUGIN_MARKDOWN_NOTE_VIEW_ID } from "../features/plugins/pluginMarkdownNote"

type WorkspaceBridge = Parameters<typeof setWorkspaceFunctions>[0]
type WorkspaceOpenOptions = NonNullable<Parameters<WorkspaceBridge["openFile"]>[1]>
type WorkspaceMarkdownTab = Parameters<WorkspaceBridge["openMarkdownTab"]>[1]

export function getWorkspaceOpenTabOptions(options?: WorkspaceOpenOptions): OpenTabOptions {
	const target = options?.target ?? "active"
	const openTabOptions: OpenTabOptions = {
		forceNew: options?.newTab,
	}
	if (target === "active") return openTabOptions
	const placement: Record<
		Exclude<WorkspaceOpenOptions["target"], "active" | undefined>,
		Required<Pick<OpenTabOptions, "split" | "splitPosition">>
	> = {
		left: { split: "horizontal", splitPosition: "before" },
		right: { split: "horizontal", splitPosition: "after" },
		top: { split: "vertical", splitPosition: "before" },
		bottom: { split: "vertical", splitPosition: "after" },
	}
	return {
		...openTabOptions,
		paneId: useWorkspaceStore.getState().activePaneId,
		...placement[target],
	}
}

function findPluginMarkdownTab(
	pluginId: string,
	tabId: string,
): { tabId: string; paneId: string } | null {
	for (const [paneId, pane] of Object.entries(useWorkspaceStore.getState().panes)) {
		for (const tab of pane.tabs) {
			const viewState = tab.viewState
			if (
				tab.tabType === "view" &&
				tab.viewId === PLUGIN_MARKDOWN_NOTE_VIEW_ID &&
				viewState?.pluginId === pluginId &&
				viewState.id === tabId
			) {
				return { tabId: tab.id, paneId }
			}
		}
	}
	return null
}

function getPluginMarkdownViewState(pluginId: string, tab: WorkspaceMarkdownTab) {
	return {
		pluginId,
		id: tab.id ?? null,
		title: tab.title,
		content: tab.content,
	}
}

export function openPluginMarkdownTab(
	pluginId: string,
	tab: WorkspaceMarkdownTab,
	options?: WorkspaceOpenOptions,
): void {
	const viewState = getPluginMarkdownViewState(pluginId, tab)
	const existing = tab.id && !options?.newTab ? findPluginMarkdownTab(pluginId, tab.id) : null
	const workspace = useWorkspaceStore.getState()

	if (existing) {
		workspace.updateViewTab(existing.tabId, existing.paneId, {
			title: tab.title,
			viewState,
		})
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
