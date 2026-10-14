import { cn } from "@cortex/ui/lib/utils"
import { Check } from "lucide-react"
import type React from "react"
import { revealClass } from "../../site/motion"

export const homeWrapClass = "mx-auto w-[min(1160px,calc(100%-48px))] max-sm:w-[calc(100%-40px)]"
export const homeH2Class =
	"text-[clamp(34px,4.4vw,56px)] leading-[1.04] font-semibold tracking-[-0.035em] max-sm:text-[34px] max-sm:leading-[1.06]"

export function HomeSection({
	id,
	className,
	children,
	...props
}: React.ComponentProps<"section">) {
	return (
		<section
			id={id}
			className={cn("pt-[168px] max-[760px]:pt-28 max-sm:pt-[88px]", className)}
			{...props}
		>
			<div className={homeWrapClass}>{children}</div>
		</section>
	)
}

export function QuietHeading({
	as: Heading = "h2",
	title,
	quiet,
	className,
	id,
}: {
	as?: "h1" | "h2"
	title: string
	quiet: string
	className?: string
	id?: string
}) {
	return (
		<Heading id={id} className={cn(homeH2Class, className)}>
			{title} <span className="text-text-muted">{quiet}</span>
		</Heading>
	)
}

export function GroupHeading({
	title,
	quiet,
	description,
	headingId,
}: {
	title: string
	quiet: string
	description: string
	headingId?: string
}) {
	return (
		<div className={cn("mx-auto max-w-[760px] text-center", revealClass)}>
			<QuietHeading id={headingId} title={title} quiet={quiet} />
			<p className="mt-4 text-[18px] leading-[1.55] text-text-secondary max-sm:text-[16px]">
				{description}
			</p>
		</div>
	)
}

export function CheckList({ items, className }: { items: readonly string[]; className?: string }) {
	return (
		<ul className={cn("grid gap-2.5 text-[15px] leading-[1.5] text-text-primary", className)}>
			{items.map((item) => (
				<li key={item} className="flex gap-2.5">
					<Check className="mt-[3px] size-4 shrink-0 text-brand-text" aria-hidden="true" />
					<span>{item}</span>
				</li>
			))}
		</ul>
	)
}

export function HomePill({ label, tone }: { label: string; tone: "soon" | "new" }) {
	return (
		<span
			className={cn(
				"inline-flex h-5 items-center rounded-full px-2 text-[11.5px] leading-none font-medium tracking-normal",
				tone === "new" ? "bg-brand-subtle text-brand-text" : "bg-home-violet/14 text-home-violet",
			)}
		>
			{label}
		</span>
	)
}
