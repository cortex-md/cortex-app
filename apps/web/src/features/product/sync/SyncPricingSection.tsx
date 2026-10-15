import { Button } from "@cortex/ui/button"
import { cn } from "@cortex/ui/lib/utils"
import { Laptop, Smartphone } from "lucide-react"
import { syncPage } from "../../../content/product"
import { trackEvent } from "../../../lib/analytics"
import { revealClass } from "../../site/motion"
import { CheckList, GroupHeading, ProductSection } from "../shared/layout"

const { pricing } = syncPage

function Amount({ price, cadence, size }: { price: string; cadence: string; size: "lg" | "sm" }) {
	return (
		<div className={cn("flex items-baseline gap-2", size === "sm" && "mt-2.5 mb-2")}>
			<b
				className={cn(
					"leading-none font-semibold",
					size === "lg"
						? "text-[64px] tracking-[-0.05em] max-sm:text-[52px]"
						: "text-[34px] tracking-[-0.03em]",
				)}
			>
				{price}
			</b>
			<span className="text-[15px] leading-none text-text-muted">{cadence}</span>
		</div>
	)
}

export function SyncPricingSection() {
	const { plan } = pricing

	return (
		<ProductSection id="pricing">
			<GroupHeading title={pricing.title} quiet={pricing.quiet} body={pricing.body} />
			<div
				className={cn(
					"mt-14 grid grid-cols-[1.5fr_1fr] gap-4 text-left max-[1000px]:grid-cols-[minmax(0,1fr)]",
					revealClass,
				)}
			>
				<div className="flex flex-col rounded-[26px] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--accent)_9%,var(--bg-elevated)),var(--bg-elevated)_50%)] p-[34px] shadow-[0_0_0_1.5px_var(--accent),var(--site-lift)] max-sm:p-6">
					<div className="flex items-start justify-between gap-6 max-sm:flex-col max-sm:gap-3.5">
						<div>
							<h3 className="text-[22px] leading-[1.2] font-semibold tracking-[-0.02em]">
								{plan.name}
							</h3>
							<p className="mt-2 max-w-[360px] text-[15.5px] leading-[1.5] text-text-secondary">
								{plan.description}
							</p>
						</div>
						<Amount price={plan.price} cadence={plan.cadence} size="lg" />
					</div>
					<CheckList
						items={plan.features}
						className="mt-[26px] grid-cols-2 gap-x-6 gap-y-3 border-sep border-t pt-[22px] text-[15px] leading-[1.4] max-sm:grid-cols-[minmax(0,1fr)]"
					/>
					<div className="mt-7 mb-[26px] flex items-center gap-4 max-sm:flex-col max-sm:items-stretch">
						<Button size="lg" asChild>
							<a
								href={plan.cta.href}
								onClick={() =>
									trackEvent({ name: "pricing_cta_clicked", plan: "sync", page: "sync" })
								}
							>
								{plan.cta.label}
							</a>
						</Button>
						<span className="text-[13px] leading-[1.4] text-text-muted">{plan.fine}</span>
					</div>
					<div className="mt-auto flex flex-wrap items-center gap-2 border-sep border-t pt-[22px] text-[13px] leading-none text-text-muted">
						<span className="mr-1">{plan.devicesLabel}</span>
						{plan.devices.map((device) => (
							<em
								key={device}
								className="inline-flex items-center gap-1.5 rounded-full bg-bg-primary px-2.5 py-1.5 text-text-secondary not-italic shadow-ring"
							>
								<Laptop className="size-3.5" aria-hidden="true" />
								{device}
							</em>
						))}
						<em className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-text-muted not-italic shadow-[inset_0_0_0_1px_var(--site-sep)]">
							<Smartphone className="size-3.5" aria-hidden="true" />
							{plan.soonDevice}
						</em>
					</div>
				</div>
				<div className="grid gap-4">
					{pricing.sidePlans.map((sidePlan) => (
						<div key={sidePlan.name} className="rounded-[22px] bg-bg-elevated p-6 shadow-ring">
							<h3 className="text-[22px] leading-[1.2] font-semibold tracking-[-0.02em]">
								{sidePlan.name}
							</h3>
							<Amount price={sidePlan.price} cadence={sidePlan.cadence} size="sm" />
							<p className="mb-4 text-[14.5px] leading-[1.5] text-text-secondary">
								{sidePlan.body}
							</p>
							<Button variant="secondary" asChild>
								<a
									href={sidePlan.cta.href}
									onClick={() =>
										trackEvent({ name: "pricing_cta_clicked", plan: sidePlan.plan, page: "sync" })
									}
								>
									{sidePlan.cta.label}
								</a>
							</Button>
						</div>
					))}
				</div>
			</div>
			<p className="mt-7 text-center text-[13px] leading-[1.4] text-text-muted">{pricing.fine}</p>
		</ProductSection>
	)
}
