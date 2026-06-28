import { useVaultStore, useWorkspaceStore } from "@cortex/core"
import { type MarketplaceTab, useMarketplaceStore } from "@cortex/marketplace"
import { MARKETPLACE_VIEW_ID } from "./marketplaceWorkspaceView"

export interface OpenMarketplaceViewOptions {
	selectedEntryId?: string
}

export interface MarketplaceOpenRequest extends OpenMarketplaceViewOptions {
	tab: MarketplaceTab
}

export type OpenMarketplaceHandler = (
	tab: MarketplaceTab,
	options?: OpenMarketplaceViewOptions,
) => boolean | void | Promise<void>

function findMarketplaceTab(): { tabId: string; paneId: string } | null {
	for (const [paneId, pane] of Object.entries(useWorkspaceStore.getState().panes)) {
		for (const tab of pane.tabs) {
			if (tab.tabType === "view" && tab.viewId === MARKETPLACE_VIEW_ID) {
				return { tabId: tab.id, paneId }
			}
		}
	}
	return null
}

export function openMarketplaceView(
	tab: MarketplaceTab = "plugins",
	options: OpenMarketplaceViewOptions = {},
): boolean {
	if (!useVaultStore.getState().vault) return false

	useMarketplaceStore.getState().setActiveTab(tab)
	if (options.selectedEntryId) {
		useMarketplaceStore.getState().selectEntry(options.selectedEntryId)
	}

	const workspace = useWorkspaceStore.getState()
	const existing = findMarketplaceTab()
	const viewState = {
		tab,
		...(options.selectedEntryId ? { selectedEntryId: options.selectedEntryId } : {}),
	}
	if (existing) {
		workspace.updateViewTab(existing.tabId, existing.paneId, {
			title: "Marketplace",
			viewState,
		})
		workspace.activateTab(existing.tabId, existing.paneId)
		return true
	}

	workspace.openViewTab(MARKETPLACE_VIEW_ID, "Marketplace", {
		viewState,
	})
	return true
}
