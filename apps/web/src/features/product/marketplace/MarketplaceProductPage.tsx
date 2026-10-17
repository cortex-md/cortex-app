import { MarketplaceHero } from "./MarketplaceHero"
import { MarketplacePermissionsSection } from "./MarketplacePermissionsSection"
import { MarketplaceShareSection } from "./MarketplaceShareSection"
import { MarketplaceTemplatesSection } from "./MarketplaceTemplatesSection"
import { MarketplaceThemesSection } from "./MarketplaceThemesSection"

export function MarketplaceProductPage() {
	return (
		<>
			<MarketplaceHero />
			<MarketplacePermissionsSection />
			<MarketplaceThemesSection />
			<MarketplaceTemplatesSection />
			<MarketplaceShareSection />
		</>
	)
}
