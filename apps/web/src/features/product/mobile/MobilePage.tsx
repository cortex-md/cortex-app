import { mobilePage } from "../../../content/product"
import { FinalCta } from "../shared/layout"
import { MobileHero } from "./MobileHero"
import { MobileStatusSection } from "./MobileStatusSection"
import { MobileStoriesSection } from "./MobileStoriesSection"

export function MobilePage() {
	return (
		<>
			<MobileHero />
			<MobileStoriesSection />
			<MobileStatusSection />
			<FinalCta
				title={mobilePage.final.title}
				quiet={mobilePage.final.quiet}
				cta={mobilePage.final.cta}
				page="mobile"
			/>
		</>
	)
}
