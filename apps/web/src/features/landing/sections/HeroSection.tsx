import { Button } from "@cortex/ui/button"
import { homeHero } from "../../../content/landing"
import { trackEvent } from "../../../lib/analytics"
import { Painting } from "../../site/Painting"
import { homeWrapClass } from "../components/HomeLayout"
import { HeroWindow } from "../components/mocks/HeroWindow"

const heroEnterClass = "animate-home-in motion-reduce:animate-none"

export function HeroSection() {
	return (
		<section className="relative pt-[88px] text-center max-sm:pt-10" aria-labelledby="home-title">
			<div className={homeWrapClass}>
				<h1
					id="home-title"
					className={`text-[clamp(44px,7vw,88px)] leading-[0.98] font-semibold tracking-[-0.045em] max-sm:text-[44px] max-sm:leading-[1.02] max-sm:tracking-[-0.04em] ${heroEnterClass}`}
				>
					{homeHero.title}
					<br />
					<span className="text-text-muted">{homeHero.quiet}</span>
				</h1>
				<p
					className={`mx-auto mt-6 max-w-[600px] text-[19px] leading-[1.55] text-text-secondary max-sm:text-[16.5px] ${heroEnterClass}`}
					style={{ animationDelay: "0.08s" }}
				>
					{homeHero.description}
				</p>
				<div
					className={`mt-9 flex flex-wrap justify-center gap-2.5 max-sm:flex-col max-sm:items-stretch max-sm:gap-2 ${heroEnterClass}`}
					style={{ animationDelay: "0.16s" }}
				>
					<Button size="lg" asChild>
						<a
							href={homeHero.primaryCta.href}
							onClick={() =>
								trackEvent({ name: "hero_cta_clicked", page: "home", cta: "download" })
							}
						>
							{homeHero.primaryCta.label}
						</a>
					</Button>
					<Button size="lg" variant="secondary" asChild>
						<a
							href={homeHero.secondaryCta.href}
							onClick={() =>
								trackEvent({ name: "hero_cta_clicked", page: "home", cta: "products" })
							}
						>
							{homeHero.secondaryCta.label}
						</a>
					</Button>
				</div>
				<p
					className="mt-[18px] text-[13.5px] leading-none text-text-muted animate-home-fade motion-reduce:animate-none"
					style={{ animationDelay: "0.24s" }}
				>
					{homeHero.availabilityPrefix}{" "}
					<a
						className="rounded-sm text-text-secondary underline-offset-2 outline-none hover:underline focus-visible:shadow-focus"
						href={homeHero.availabilityLink.href}
					>
						{homeHero.availabilityLink.label}
					</a>{" "}
					{homeHero.availabilitySuffix}
				</p>
				<div className="relative isolate mx-auto mt-16 max-w-[1180px] overflow-hidden rounded-[28px] px-[72px] pt-[72px] shadow-[0_30px_80px_-40px_rgba(60,40,40,0.35)] max-sm:mt-10 max-sm:rounded-[22px] max-sm:pt-7 max-sm:pr-0 max-sm:pl-5">
					<Painting
						name="dawn"
						position="center 70%"
						priority
						sizes="(max-width: 640px) 100vw, 1180px"
					/>
					<HeroWindow />
				</div>
			</div>
		</section>
	)
}
