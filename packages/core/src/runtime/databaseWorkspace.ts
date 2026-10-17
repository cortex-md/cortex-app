import { getBaseName } from "@cortex/platform/utils"
import { useVaultStore } from "../stores/vaultStore"
import { useWorkspaceStore } from "../stores/workspaceStore"

import { DATABASE_VIEW_ID } from "./databaseViewIds"

export { DATABASE_VIEW_ID }

export interface DatabaseViewState {
	filePath: string
	viewId: string | null
	search: string
	peekPath: string | null
	collapsed: string[]
}

export function readDatabaseViewState(viewState: Record<string, unknown>): DatabaseViewState {
	return {
		filePath: typeof viewState.filePath === "string" ? viewState.filePath : "",
		viewId: typeof viewState.viewId === "string" ? viewState.viewId : null,
		search: typeof viewState.search === "string" ? viewState.search : "",
		peekPath: typeof viewState.peekPath === "string" ? viewState.peekPath : null,
		collapsed: Array.isArray(viewState.collapsed)
			? viewState.collapsed.filter((item): item is string => typeof item === "string")
			: [],
	}
}

export function openDatabaseView(folderPath: string, options: { newTab?: boolean } = {}): void {
	if (!useVaultStore.getState().vault || !folderPath) return
	const workspace = useWorkspaceStore.getState()
	if (!options.newTab) {
		for (const [paneId, pane] of Object.entries(workspace.panes)) {
			const existing = pane.tabs.find(
				(tab) =>
					tab.tabType === "view" &&
					tab.viewId === DATABASE_VIEW_ID &&
					tab.viewState?.filePath === folderPath,
			)
			if (existing) {
				workspace.activateTab(existing.id, paneId)
				return
			}
		}
	}
	workspace.openViewTab(DATABASE_VIEW_ID, getBaseName(folderPath), {
		viewState: { filePath: folderPath },
		forceNew: true,
	})
}
