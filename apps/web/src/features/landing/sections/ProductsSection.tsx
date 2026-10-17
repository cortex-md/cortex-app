import { cn } from "@cortex/ui/lib/utils"
import { ArrowRight } from "lucide-react"
import { productCards, productsGroup } from "../../../content/landing"
import { trackEvent } from "../../../lib/analytics"
import { revealClass } from "../../site/motion"
import { Painting } from "../../site/Painting"
import { HomePill, HomeSection, QuietHeading } from "../components/HomeLayout"
import { ProductCardArt } from "../components/mocks/ProductCardArt"

const cardClass =
	"group flex flex-col gap-4 rounded-[22px] bg-bg-elevated p-[22px] text-inherit no-underline shadow-ring outline-none transition-[translate,box-shadow] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"

export function ProductsSection() {
	return (
		<HomeSection id={productsGroup.id} aria-labelledby="products-title">
			<QuietHeading
				id="products-title"
				title={productsGroup.title}
				quiet={productsGroup.quiet}
				className={cn("text-center", revealClass)}
			/>
			<div className="mt-14 grid grid-cols-3 gap-3.5 max-[1000px]:grid-cols-2 max-sm:grid-cols-1 [&>:first-child]:col-span-2 max-sm:[&>:first-child]:col-span-1">
				{productCards.map((card) => {
					const body = (
						<>
							<div
								className="relative isolate h-[170px] overflow-hidden rounded-[14px]"
								aria-hidden="true"
							>
								<Painting
									name={card.painting}
									position={card.position}
									blur="soft"
									duration="fast"
									sizes="(max-width: 640px) 100vw, 380px"
								/>
								<div className="absolute inset-0 z-[1]">
									<ProductCardArt art={card.art} />
								</div>
							</div>
							<h3 className="flex items-center gap-2 text-[20px] leading-[1.2] font-semibold tracking-[-0.02em]">
								{card.title}
								{card.pill ? <HomePill label={card.pill.label} tone={card.pill.tone} /> : null}
							</h3>
							<p className="text-[14.5px] leading-[1.5] text-text-secondary">{card.description}</p>
							{card.cta ? (
								<span className="mt-auto inline-flex items-center gap-1.5 text-[14px] leading-none font-medium text-text-primary">
									{card.cta}
									<ArrowRight
										className="size-4 transition-transform duration-[250ms] group-hover:translate-x-1 motion-reduce:transition-none"
										aria-hidden="true"
									/>
								</span>
							) : null}
						</>
					)

					if (!card.href) {
						return (
							<article key={card.title} className={cn(cardClass, revealClass)}>
								{body}
							</article>
						)
					}

					return (
						<a
							key={card.title}
							href={card.href}
							className={cn(
								cardClass,
								"hover:-translate-y-1 hover:shadow-lift focus-visible:shadow-focus motion-reduce:hover:translate-y-0",
								revealClass,
							)}
							onClick={() =>
								trackEvent({ name: "hero_cta_clicked", page: "home", cta: card.title })
							}
						>
							{body}
						</a>
					)
				})}
			</div>
		</HomeSection>
	)
}
