import { useMotionPause } from "../site/motion"
import { HomeMotionContext } from "./components/HomeMotion"
import { DownloadSection } from "./sections/DownloadSection"
import { HeroSection } from "./sections/HeroSection"
import { KeepSection } from "./sections/KeepSection"
import { OpenSourceSection } from "./sections/OpenSourceSection"
import { OrganizeSection } from "./sections/OrganizeSection"
import { PricingSection } from "./sections/PricingSection"
import { ProductsSection } from "./sections/ProductsSection"
import { RealWorkSection } from "./sections/RealWorkSection"
import { RecentlyShippedSection } from "./sections/RecentlyShippedSection"
import { TogetherSection } from "./sections/TogetherSection"

export function LandingPage() {
	const { isPaused, togglePaused, pausedAttribute } = useMotionPause()

	return (
		<HomeMotionContext.Provider value={{ isPaused, togglePaused }}>
			<div className="overflow-x-clip" {...pausedAttribute}>
				<HeroSection />
				<div id="features">
					<OrganizeSection />
					<KeepSection />
					<TogetherSection />
					<RealWorkSection />
				</div>
				<ProductsSection />
				<OpenSourceSection />
				<PricingSection />
				<RecentlyShippedSection />
				<DownloadSection />
			</div>
		</HomeMotionContext.Provider>
	)
}
