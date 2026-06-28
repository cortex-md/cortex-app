import { Button } from "@cortex/ui/button"
import { ArrowRight } from "lucide-react"
import { pricingPlan } from "../../../content/landing"
import { trackLandingEvent } from "../../../lib/analytics"

export function PricingSection() {
	return (
		<section className="scroll-mt-24 py-24 max-md:py-[80px] max-sm:py-[68px]" id="pricing">
			<div className="mx-auto w-[min(1180px,calc(100%_-_64px))] max-lg:w-[min(calc(100%_-_48px),940px)] max-md:w-[min(calc(100%_-_36px),720px)] max-sm:w-[min(calc(100%_-_28px),520px)]">
				<div className="grid grid-cols-[minmax(0,0.76fr)_minmax(280px,0.34fr)] items-center gap-8 rounded-2xl bg-bg-elevated p-6 shadow-[0_0_0_1px_var(--border-subtle),0_1px_2px_rgba(24,18,8,0.04)] max-lg:grid-cols-1 max-sm:p-5">
					<div className="min-w-0">
						<p className="m-0 text-sm leading-6 font-semibold text-brand-text">
							{pricingPlan.name}
						</p>
						<h2 className="mt-4 mb-0 max-w-[720px] text-balance text-[clamp(32px,3.8vw,48px)] leading-[1.06] font-semibold tracking-[-0.018em]">
							Sync when you want it. The files stay yours.
						</h2>
						<p className="mt-5 max-w-[600px] text-pretty text-[15px] leading-[1.65] text-muted-foreground">
							Hosted Cortex Sync adds encrypted blob storage to the local-first Markdown workspace.
							It stays optional, and the vault stays readable on disk.
						</p>
					</div>

					<aside className="flex min-w-0 flex-col rounded-xl bg-bg-primary p-5 shadow-[inset_0_1px_rgba(255,255,255,0.18),0_0_0_1px_var(--border-subtle)]">
						<div>
							<div className="flex items-end gap-2">
								<span className="text-[clamp(58px,8vw,84px)] leading-none font-semibold tracking-[-0.035em] text-text-primary tabular-nums">
									{pricingPlan.price}
								</span>
								<span className="pb-2 text-[15px] leading-6 font-medium text-text-muted">
									{pricingPlan.cadence}
								</span>
							</div>
							<h3 className="mt-5 mb-0 text-pretty text-[20px] leading-[1.2] font-semibold tracking-[-0.01em] text-text-primary">
								{pricingPlan.title}
							</h3>
						</div>

						<div className="mt-7">
							<Button
								className="min-h-11 w-full bg-[#303342] px-4 text-white shadow-[0_1px_2px_rgba(17,19,26,0.14)] tracking-normal transition-[background-color,scale] duration-150 ease-out hover:bg-[#1f222c] active:scale-[0.96] motion-reduce:transition-colors motion-reduce:active:scale-100"
								asChild
								onClick={() =>
									trackLandingEvent({ name: "pricing_checkout_clicked", location: "pricing" })
								}
							>
								<a href={pricingPlan.ctaHref}>
									{pricingPlan.ctaLabel}
									<ArrowRight className="size-4" aria-hidden="true" />
								</a>
							</Button>
							<p className="mt-4 text-pretty text-[13px] leading-5 text-text-muted">
								{pricingPlan.note}
							</p>
						</div>
					</aside>
				</div>
			</div>
		</section>
	)
}
