import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@cortex/ui/accordion"
import { Button } from "@cortex/ui/button"
import { cn } from "@cortex/ui/lib/utils"
import { Check, ChevronDown } from "lucide-react"
import { useState } from "react"
import {
	pricingComparison,
	pricingFaq,
	pricingPlans,
	pricingSection,
} from "../../../content/landing"
import { trackEvent } from "../../../lib/analytics"
import { revealClass } from "../../site/motion"
import { CheckList, GroupHeading, HomeSection } from "../components/HomeLayout"

function PricingPlans() {
	return (
		<div className="mt-14 grid grid-cols-3 items-stretch gap-4 max-[1000px]:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-7">
			{pricingPlans.map((plan) => (
				<article
					key={plan.id}
					aria-labelledby={`plan-${plan.id}`}
					className={cn(
						"relative flex flex-col rounded-3xl p-7 transition-[translate,box-shadow] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-[3px] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
						plan.featured
							? "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_7%,var(--bg-elevated)),var(--bg-elevated)_40%)] shadow-[0_0_0_1.5px_var(--accent),var(--site-lift)] max-sm:-order-1"
							: "bg-bg-elevated shadow-ring hover:shadow-lift",
						revealClass,
					)}
				>
					{plan.featured ? (
						<span className="absolute -top-3 left-7 rounded-full bg-brand px-2.5 py-1 text-[12px] leading-none font-medium text-text-on-accent">
							{pricingSection.recommended}
						</span>
					) : null}
					<h3
						id={`plan-${plan.id}`}
						className="text-[20px] leading-[1.2] font-semibold tracking-[-0.01em]"
					>
						{plan.name}
					</h3>
					<p className="mt-1.5 min-h-[44px] text-[14.5px] leading-[1.5] text-text-secondary">
						{plan.who}
					</p>
					<div className="mt-[22px] flex items-baseline gap-2">
						<b className="text-[44px] leading-none font-semibold tracking-[-0.04em]">
							{plan.price}
						</b>
						<span className="text-[15px] leading-none text-text-muted">{plan.priceNote}</span>
					</div>
					<p className="mt-2 text-[13px] leading-[1.4] text-text-muted">{plan.note}</p>
					<Button
						className="mt-[22px] w-full"
						size="lg"
						variant={plan.featured ? "default" : "secondary"}
						asChild
					>
						<a
							href={plan.cta.href}
							onClick={() =>
								trackEvent({ name: "pricing_cta_clicked", plan: plan.id, page: "home" })
							}
						>
							{plan.cta.label}
						</a>
					</Button>
					<p className="mt-6 border-sep border-t pt-5 text-[14px] leading-[1.4] font-medium text-text-primary">
						{plan.lead}
					</p>
					<CheckList
						className="mt-3 text-[14.5px] leading-[1.45] text-text-secondary"
						items={plan.features}
					/>
				</article>
			))}
		</div>
	)
}

function IncludedMark({ included }: { included: boolean }) {
	return included ? (
		<>
			<Check className="mx-auto size-4" aria-hidden="true" />
			<span className="sr-only">Included</span>
		</>
	) : (
		<>
			<span aria-hidden="true">—</span>
			<span className="sr-only">Not included</span>
		</>
	)
}

function ComparisonTable() {
	return (
		<div
			id="pricing-comparison"
			className="mt-4 overflow-hidden rounded-[20px] bg-bg-elevated shadow-ring animate-home-pop motion-reduce:animate-none max-sm:overflow-x-auto"
		>
			<table className="w-full border-collapse text-left max-sm:min-w-[600px]">
				<caption className="sr-only">Compare plans</caption>
				<colgroup>
					<col className="w-[34.8%]" />
					<col />
					<col className="bg-[color-mix(in_srgb,var(--accent)_4%,transparent)]" />
					<col />
				</colgroup>
				<thead>
					<tr className="h-14 border-sep border-b text-[14.5px] leading-none font-semibold">
						<th scope="col" className="pl-6">
							<span className="sr-only">Feature</span>
						</th>
						{pricingComparison.columns.map((column, index) => (
							<th
								key={column}
								scope="col"
								className={cn(
									"text-center",
									index === 1 && "text-brand-text",
									index === 2 && "pr-6",
								)}
							>
								{column}
							</th>
						))}
					</tr>
				</thead>
				{pricingComparison.groups.map((group) => (
					<tbody key={group.title}>
						<tr>
							<th
								scope="colgroup"
								colSpan={4}
								className="px-6 pt-[18px] pb-2 text-[13px] leading-none font-medium text-text-muted"
							>
								{group.title}
							</th>
						</tr>
						{group.rows.map((row) => (
							<tr
								key={row.label}
								className="h-[46px] border-sep border-t text-[14.5px] leading-[1.4]"
							>
								<th scope="row" className="py-2 pl-6 font-normal">
									{row.label}
								</th>
								{row.values.map((included, index) => (
									<td
										key={pricingComparison.columns[index]}
										className={cn(
											"text-center",
											included ? "text-brand-text" : "text-text-muted",
											index === 2 && "pr-6",
										)}
									>
										<IncludedMark included={included} />
									</td>
								))}
							</tr>
						))}
					</tbody>
				))}
			</table>
		</div>
	)
}

function PricingFaq() {
	return (
		<div className={cn("mx-auto mt-[88px] max-w-[760px] max-sm:mt-16", revealClass)}>
			<h3 className="mb-3.5 text-center text-[24px] leading-[1.2] font-semibold tracking-[-0.02em]">
				{pricingSection.faqTitle}
			</h3>
			<Accordion
				type="single"
				collapsible
				defaultValue="faq-0"
				onValueChange={(value) => {
					const index = Number(value.replace("faq-", ""))
					const item = pricingFaq[index]
					if (value && item) trackEvent({ name: "faq_opened", question: item.question })
				}}
			>
				{pricingFaq.map((item, index) => (
					<AccordionItem
						key={item.question}
						value={`faq-${index}`}
						className="border-sep border-b last:border-b"
					>
						<AccordionTrigger className="items-center px-1 py-5 text-[16.5px] leading-[1.4] font-medium text-text-primary hover:no-underline focus-visible:shadow-focus focus-visible:ring-0">
							{item.question}
						</AccordionTrigger>
						<AccordionContent className="mx-1 -mt-1.5 max-w-[640px] pb-5 text-[15.5px] leading-[1.6] text-text-secondary">
							{item.answer}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	)
}

export function PricingSection() {
	const [isComparing, setIsComparing] = useState(false)

	return (
		<HomeSection id={pricingSection.id} aria-labelledby="pricing-title">
			<GroupHeading
				headingId="pricing-title"
				title={pricingSection.title}
				quiet={pricingSection.quiet}
				description={pricingSection.description}
			/>
			<PricingPlans />
			<div className={cn("mt-7 flex justify-center", revealClass)}>
				<Button
					variant="ghost"
					className="h-auto px-4 py-2.5 text-[14.5px] text-text-primary"
					aria-expanded={isComparing}
					aria-controls="pricing-comparison"
					onClick={() => setIsComparing((open) => !open)}
				>
					{isComparing ? pricingSection.hideCompareLabel : pricingSection.compareLabel}
					<ChevronDown
						className={cn(
							"size-4 transition-transform duration-[250ms] motion-reduce:transition-none",
							isComparing && "rotate-180",
						)}
						aria-hidden="true"
					/>
				</Button>
			</div>
			{isComparing ? <ComparisonTable /> : null}
			<PricingFaq />
			<p className="mt-7 text-center text-[13px] leading-[1.4] text-text-muted">
				{pricingSection.fine}
			</p>
		</HomeSection>
	)
}
