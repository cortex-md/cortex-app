import { cliPage } from "../../../content/product"
import { Painting } from "../../site/Painting"
import { CtaRow, MockFigure, ProductHero } from "../shared/layout"
import { type TerminalLine, TerminalWindow } from "../shared/TerminalWindow"

const { hero, terminal } = cliPage
const lines = terminal.lines as readonly TerminalLine[]

export function CliHero() {
	return (
		<ProductHero title={hero.title} quiet={hero.quiet} lead={hero.lead}>
			<CtaRow primary={cliPage.primaryCta} secondary={cliPage.secondaryCta} page="cli" />
			<MockFigure
				label={terminal.alt}
				className="relative isolate mt-16 overflow-hidden rounded-[28px] px-20 py-[72px] max-[1000px]:px-8 max-[1000px]:py-12 max-sm:mt-10 max-sm:rounded-[22px] max-sm:py-7 max-sm:pr-0 max-sm:pl-5"
			>
				<Painting name="dusk" position="center 55%" priority />
				<TerminalWindow
					title={terminal.title}
					lines={lines}
					finalCwd="~/plugins/word-count"
					className="relative z-[1] max-sm:m-0 max-sm:w-[760px] max-sm:max-w-none max-sm:[zoom:0.56]"
				/>
			</MockFigure>
		</ProductHero>
	)
}
