import { useVaultStore, useWorkspaceStore } from "@cortex/core"

export const TAG_VIEW_ID = "tag"

export interface TagViewState {
	tag: string
	childTag?: string | null
}

export function readTagViewState(viewState: Record<string, unknown>): TagViewState {
	return {
		tag: typeof viewState.tag === "string" ? viewState.tag : "",
		childTag: typeof viewState.childTag === "string" ? viewState.childTag : null,
	}
}

export function openTagView(tag: string): void {
	if (!useVaultStore.getState().vault || !tag) return
	const workspace = useWorkspaceStore.getState()
	for (const [paneId, pane] of Object.entries(workspace.panes)) {
		const existing = pane.tabs.find(
			(tab) => tab.tabType === "view" && tab.viewId === TAG_VIEW_ID && tab.viewState?.tag === tag,
		)
		if (existing) {
			workspace.activateTab(existing.id, paneId)
			return
		}
	}
	workspace.openViewTab(TAG_VIEW_ID, `#${tag}`, { viewState: { tag }, forceNew: true })
}
