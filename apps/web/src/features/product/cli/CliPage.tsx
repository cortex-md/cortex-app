import { cliPage } from "../../../content/product"
import { FinalCta } from "../shared/layout"
import { CliCommandsSection } from "./CliCommandsSection"
import { CliHero } from "./CliHero"
import { CliStoriesSection } from "./CliStoriesSection"

export function CliPage() {
	return (
		<>
			<CliHero />
			<CliStoriesSection />
			<CliCommandsSection />
			<FinalCta
				title={cliPage.final.title}
				quiet={cliPage.final.quiet}
				cta={cliPage.final.cta}
				page="cli"
			/>
		</>
	)
}
