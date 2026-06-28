import { LandingHeader } from "./LandingHeader"
import { CliSection } from "./sections/CliSection"
import { DownloadSection } from "./sections/DownloadSection"
import { FaqSection } from "./sections/FaqSection"
import { HeroSection } from "./sections/HeroSection"
import { LandingFooter } from "./sections/LandingFooter"
import { OrganizationSection } from "./sections/OrganizationSection"
import { PluginSection } from "./sections/PluginSection"
import { PricingSection } from "./sections/PricingSection"
import { SyncSection } from "./sections/SyncSection"
import { ThemesSection } from "./sections/ThemesSection"
import { TrustStrip } from "./sections/TrustStrip"
import { WritingSection } from "./sections/WritingSection"

interface LandingPageProps {
	pluginCodeHtml: string
}

export function LandingPage({ pluginCodeHtml }: LandingPageProps) {
	return (
		<div className="overflow-clip bg-background">
			<LandingHeader />
			<main id="main-content" tabIndex={-1}>
				<HeroSection />
				<WritingSection />
				<OrganizationSection />
				<SyncSection />
				<TrustStrip />
				<PluginSection pluginCodeHtml={pluginCodeHtml} />
				<ThemesSection />
				<CliSection />
				<FaqSection />
				<PricingSection />
				<DownloadSection />
			</main>
			<LandingFooter />
		</div>
	)
}
