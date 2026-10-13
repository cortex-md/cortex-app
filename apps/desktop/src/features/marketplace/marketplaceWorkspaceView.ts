import type { MarketplaceTab } from "@cortex/marketplace"

export const MARKETPLACE_VIEW_ID = "marketplace"

export type MarketplaceViewTab = MarketplaceTab | "templates"

export interface MarketplaceViewState {
	tab?: MarketplaceViewTab
	selectedEntryId?: string
}

export function getMarketplaceViewStateTab(viewState: Record<string, unknown>): MarketplaceViewTab {
	if (viewState.tab === "templates") return "templates"
	return viewState.tab === "themes" ? "themes" : "plugins"
}

export function getMarketplaceViewStateSelectedEntryId(
	viewState: Record<string, unknown>,
): string | null {
	return typeof viewState.selectedEntryId === "string" ? viewState.selectedEntryId : null
}
