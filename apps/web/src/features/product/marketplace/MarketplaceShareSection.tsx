import { cn } from "@cortex/ui/lib/utils"
import { FileText, Gem, Plug } from "lucide-react"
import { marketplacePage } from "../../../content/product"
import { revealClass } from "../../site/motion"
import { Painting } from "../../site/Painting"
import { CtaRow, h2Class, ProductSection, TitleWithQuiet } from "../shared/layout"

const { share } = marketplacePage
const wayIcons = { template: FileText, theme: Gem, plugin: Plug } as const

export function MarketplaceShareSection() {
	return (
		<ProductSection id="build">
			<div
				className={cn(
					"relative isolate overflow-hidden rounded-[28px] px-12 py-24 text-center after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-[radial-gradient(60%_70%_at_50%_50%,color-mix(in_srgb,var(--bg-primary)_78%,transparent),color-mix(in_srgb,var(--bg-primary)_20%,transparent)_70%,transparent)] max-sm:px-6 max-sm:py-16",
					revealClass,
				)}
			>
				<Painting name="mist" position="center 55%" />
				<div className="relative z-[1] mx-auto max-w-[680px]">
					<h2 className={h2Class}>
						<TitleWithQuiet title={share.title} quiet={share.quiet} />
					</h2>
					<p className="mx-auto mt-[18px] max-w-[560px] text-[18px] leading-[1.55] text-text-secondary max-sm:text-[16px]">
						{share.body}
					</p>
					<CtaRow primary={share.primaryCta} secondary={share.secondaryCta} page="marketplace" />
				</div>
			</div>
			<div
				className={cn(
					"mt-14 grid grid-cols-3 gap-12 px-2 text-left max-sm:mt-10 max-sm:grid-cols-[minmax(0,1fr)] max-sm:gap-7",
					revealClass,
				)}
			>
				{share.ways.map((way) => {
					const Icon = wayIcons[way.icon]
					return (
						<div key={way.title}>
							<span className="inline-flex text-brand-text">
								<Icon className="size-[22px]" aria-hidden="true" />
							</span>
							<h3 className="mt-3.5 mb-1.5 text-[18px] leading-[1.3] font-semibold">{way.title}</h3>
							<p className="text-[15px] leading-[1.55] text-text-secondary">
								{way.body}
								{"link" in way ? (
									<>
										{" "}
										<a
											className="rounded-sm text-text-primary underline decoration-sep underline-offset-[3px] outline-none focus-visible:shadow-focus"
											href={way.link.href}
										>
											{way.link.label}
										</a>
										{way.link.after}
									</>
								) : null}
							</p>
						</div>
					)
				})}
			</div>
		</ProductSection>
	)
}
