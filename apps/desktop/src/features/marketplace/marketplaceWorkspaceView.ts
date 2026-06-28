import type { MarketplaceTab } from "@cortex/marketplace"

export const MARKETPLACE_VIEW_ID = "marketplace"

export interface MarketplaceViewState {
	tab?: MarketplaceTab
	selectedEntryId?: string
}

export function getMarketplaceViewStateTab(viewState: Record<string, unknown>): MarketplaceTab {
	return viewState.tab === "themes" ? "themes" : "plugins"
}

export function getMarketplaceViewStateSelectedEntryId(
	viewState: Record<string, unknown>,
): string | null {
	return typeof viewState.selectedEntryId === "string" ? viewState.selectedEntryId : null
}
