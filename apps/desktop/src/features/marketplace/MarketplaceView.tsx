import type { CoreViewProps } from "../split-view/coreViewProps"
import { MarketplaceSection } from "./MarketplaceSection"
import { MarketplaceTemplates } from "./MarketplaceTemplates"
import {
	getMarketplaceViewStateSelectedEntryId,
	getMarketplaceViewStateTab,
} from "./marketplaceWorkspaceView"

export function MarketplaceView({ viewState, onStateChange }: CoreViewProps) {
	const initialTab = getMarketplaceViewStateTab(viewState)
	const initialSelectedEntryId = getMarketplaceViewStateSelectedEntryId(viewState)

	if (initialTab === "templates") {
		return (
			<MarketplaceTemplates
				selectedId={initialSelectedEntryId}
				onSelect={(selectedEntryId) => onStateChange({ tab: "templates", selectedEntryId })}
				onTabChange={(tab) => onStateChange({ tab })}
			/>
		)
	}

	return (
		<MarketplaceSection
			initialTab={initialTab}
			initialSelectedEntryId={initialSelectedEntryId}
			onTabChange={(tab) => onStateChange({ tab })}
		/>
	)
}
