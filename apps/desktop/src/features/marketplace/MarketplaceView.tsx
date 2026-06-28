import type { CoreViewProps } from "../split-view/coreViewRegistry"
import { MarketplaceSection } from "./MarketplaceSection"
import {
	getMarketplaceViewStateSelectedEntryId,
	getMarketplaceViewStateTab,
} from "./marketplaceWorkspaceView"

export function MarketplaceView({ viewState, onStateChange }: CoreViewProps) {
	const initialTab = getMarketplaceViewStateTab(viewState)
	const initialSelectedEntryId = getMarketplaceViewStateSelectedEntryId(viewState)

	return (
		<MarketplaceSection
			initialTab={initialTab}
			initialSelectedEntryId={initialSelectedEntryId}
			onTabChange={(tab) => onStateChange({ tab })}
		/>
	)
}
