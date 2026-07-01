import { DATABASE_VIEW_ID, useDatabaseStore, useWorkspaceStore } from "@cortex/core"

export interface DatabaseViewTabState {
	databaseId: string
	viewId: string
}

export function isDatabaseViewTabState(value: unknown): value is DatabaseViewTabState {
	return (
		Boolean(value) &&
		typeof value === "object" &&
		typeof (value as DatabaseViewTabState).databaseId === "string" &&
		typeof (value as DatabaseViewTabState).viewId === "string"
	)
}

function findDatabaseViewTab(
	databaseId: string,
	viewId: string,
): { tabId: string; paneId: string } | null {
	for (const [paneId, pane] of Object.entries(useWorkspaceStore.getState().panes)) {
		for (const tab of pane.tabs) {
			if (tab.tabType !== "view" || tab.viewId !== DATABASE_VIEW_ID) continue
			if (!isDatabaseViewTabState(tab.viewState)) continue
			if (tab.viewState.databaseId === databaseId && tab.viewState.viewId === viewId) {
				return { tabId: tab.id, paneId }
			}
		}
	}
	return null
}

export function openDatabaseViewTab(databaseId: string, viewId: string): boolean {
	const catalog = useDatabaseStore.getState().catalog
	const database = catalog.databases[databaseId]
	const view = catalog.views[viewId]
	if (!database || !view) return false
	const workspace = useWorkspaceStore.getState()
	const existing = findDatabaseViewTab(databaseId, viewId)
	const title = `${database.name}: ${view.name}`
	const viewState = { databaseId, viewId }
	if (existing) {
		workspace.updateViewTab(existing.tabId, existing.paneId, { title, viewState })
		workspace.activateTab(existing.tabId, existing.paneId)
		return true
	}
	workspace.openViewTab(DATABASE_VIEW_ID, title, { viewState })
	return true
}

export function getActiveDatabaseViewState(): DatabaseViewTabState | null {
	const workspace = useWorkspaceStore.getState()
	const pane = workspace.panes[workspace.activePaneId]
	const activeTab = pane?.tabs.find((tab) => tab.id === pane.activeTabId)
	if (activeTab?.tabType !== "view" || activeTab.viewId !== DATABASE_VIEW_ID) return null
	return isDatabaseViewTabState(activeTab.viewState) ? activeTab.viewState : null
}
