import { Button } from "@cortex/ui/button"
import { cn } from "@cortex/ui/lib/utils"
import { Check, ChevronLeft } from "lucide-react"
import type React from "react"
import { trackEvent } from "../../../lib/analytics"
import { revealClass } from "../../site/motion"

export interface ProductLink {
	label: string
	href: string
}

export const wrapClass = "mx-auto w-[min(1160px,calc(100%-48px))] max-sm:w-[calc(100%-40px)]"

export const h2Class =
	"text-[clamp(34px,4.4vw,56px)] leading-[1.04] font-semibold tracking-[-0.035em] max-sm:text-[34px] max-sm:leading-[1.06]"

export function Quiet({ children }: { children: React.ReactNode }) {
	return <span className="text-text-muted">{children}</span>
}

export function TitleWithQuiet({ title, quiet }: { title: string; quiet: string }) {
	return (
		<>
			{title} <Quiet>{quiet}</Quiet>
		</>
	)
}

export function CtaRow({
	primary,
	secondary,
	page,
	className,
}: {
	primary: ProductLink
	secondary?: ProductLink
	page: string
	className?: string
}) {
	return (
		<div
			className={cn(
				"mt-9 flex flex-wrap justify-center gap-2.5 max-sm:flex-col max-sm:items-stretch max-sm:gap-2",
				className,
			)}
		>
			<Button size="lg" asChild>
				<a
					href={primary.href}
					onClick={() => trackEvent({ name: "hero_cta_clicked", page, cta: primary.label })}
				>
					{primary.label}
				</a>
			</Button>
			{secondary ? (
				<Button size="lg" variant="secondary" asChild>
					<a
						href={secondary.href}
						onClick={() => trackEvent({ name: "hero_cta_clicked", page, cta: secondary.label })}
					>
						{secondary.label}
					</a>
				</Button>
			) : null}
		</div>
	)
}

export function ProductHero({
	title,
	quiet,
	lead,
	children,
}: {
	title: string
	quiet: string
	lead: string
	children?: React.ReactNode
}) {
	return (
		<section className="pt-20 text-center max-sm:pt-10">
			<div className={wrapClass}>
				<a
					className="mb-[22px] inline-flex items-center gap-2 rounded-md text-[14px] leading-none font-medium text-text-secondary no-underline outline-none hover:text-text-primary focus-visible:shadow-focus"
					href="/"
				>
					<ChevronLeft className="size-4" aria-hidden="true" />
					Cortex
				</a>
				<h1 className="text-[72px] leading-[0.98] font-semibold tracking-[-0.045em] max-[1000px]:text-[60px] max-sm:text-[44px] max-sm:leading-[1.02] max-sm:tracking-[-0.04em]">
					<TitleWithQuiet title={title} quiet={quiet} />
				</h1>
				<p className="mx-auto mt-6 max-w-[600px] text-[19px] leading-[1.55] text-text-secondary max-sm:text-[16.5px]">
					{lead}
				</p>
				{children}
			</div>
		</section>
	)
}

export function ProductSection({
	id,
	className,
	children,
}: {
	id?: string
	className?: string
	children: React.ReactNode
}) {
	return (
		<section
			id={id}
			className={cn("scroll-mt-24 pt-[168px] max-[760px]:pt-28 max-sm:pt-[88px]", className)}
		>
			<div className={wrapClass}>{children}</div>
		</section>
	)
}

export function GroupHeading({
	title,
	quiet,
	body,
}: {
	title: string
	quiet: string
	body: string
}) {
	return (
		<div className={cn("mx-auto max-w-[760px] text-center", revealClass)}>
			<h2 className={h2Class}>
				<TitleWithQuiet title={title} quiet={quiet} />
			</h2>
			<p className="mt-4 text-[18px] leading-[1.55] text-text-secondary max-sm:text-[16px]">
				{body}
			</p>
		</div>
	)
}

export function CheckList({
	items,
	className,
	tone = "primary",
}: {
	items: readonly string[]
	className?: string
	tone?: "primary" | "secondary"
}) {
	return (
		<ul
			className={cn(
				"m-0 grid list-none p-0 text-[15px] leading-[1.5]",
				tone === "primary" ? "text-text-primary" : "text-text-secondary",
				className,
			)}
		>
			{items.map((item) => (
				<li key={item} className="flex gap-2.5">
					<Check className="mt-[3px] size-4 shrink-0 text-brand-text" aria-hidden="true" />
					<span>{item}</span>
				</li>
			))}
		</ul>
	)
}

export function FeatureStory({
	title,
	body,
	points,
	reverse = false,
	visual,
}: {
	title: string
	body: React.ReactNode
	points: readonly string[]
	reverse?: boolean
	visual: React.ReactNode
}) {
	return (
		<div
			className={cn(
				"grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] items-center gap-[72px] max-[1000px]:grid-cols-[minmax(0,1fr)] max-[1000px]:gap-9",
				revealClass,
			)}
		>
			<div
				className={cn("max-[1000px]:order-none max-[1000px]:max-w-[640px]", reverse && "order-2")}
			>
				<h3 className="text-[32px] leading-[1.15] font-semibold tracking-[-0.025em] max-sm:text-[26px]">
					{title}
				</h3>
				<p className="mt-4 text-[17px] leading-[1.65] text-text-secondary max-sm:text-[16px]">
					{body}
				</p>
				<CheckList items={points} className="mt-[22px] gap-2.5" />
			</div>
			<div className={cn("min-w-0 max-[1000px]:order-1", reverse && "order-1")}>{visual}</div>
		</div>
	)
}

export function SplitStory({
	title,
	body,
	points,
}: {
	title: string
	body: React.ReactNode
	points: readonly string[]
}) {
	return (
		<div
			className={cn(
				"grid grid-cols-[1fr_1.1fr] items-center gap-14 max-[1000px]:grid-cols-[minmax(0,1fr)] max-[1000px]:gap-9",
				revealClass,
			)}
		>
			<div>
				<h3 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.025em] max-sm:text-[26px]">
					{title}
				</h3>
				<p className="mt-3.5 text-[16.5px] leading-[1.6] text-text-secondary max-sm:text-[16px]">
					{body}
				</p>
			</div>
			<CheckList items={points} tone="secondary" className="mt-[18px] gap-2" />
		</div>
	)
}

export function StepCards({
	title,
	steps,
}: {
	title: string
	steps: ReadonlyArray<{ title: string; body: string; mono?: boolean }>
}) {
	return (
		<>
			<h2 className={cn(h2Class, "text-center", revealClass)}>{title}</h2>
			<div className="mt-12 grid grid-cols-3 gap-3.5 max-sm:grid-cols-[minmax(0,1fr)]">
				{steps.map((step) => (
					<div
						key={step.title}
						className={cn("rounded-[18px] bg-bg-elevated p-[22px] shadow-ring", revealClass)}
					>
						<h3
							className={cn(
								"block text-[17px] leading-[1.3] font-semibold",
								step.mono && "font-mono text-[15px] font-medium",
							)}
						>
							{step.title}
						</h3>
						<p className="mt-1.5 text-[14.5px] leading-[1.5] text-text-secondary">{step.body}</p>
					</div>
				))}
			</div>
		</>
	)
}

export function FinalCta({
	title,
	quiet,
	cta,
	page,
}: {
	title: string
	quiet: string
	cta: ProductLink
	page: string
}) {
	return (
		<section
			className={cn(
				"mt-[140px] bg-[radial-gradient(60%_80%_at_50%_0%,var(--accent-subtle),transparent_70%)] py-[120px] text-center max-sm:mt-24 max-sm:py-20",
				revealClass,
			)}
		>
			<div className={wrapClass}>
				<h2 className={h2Class}>
					<TitleWithQuiet title={title} quiet={quiet} />
				</h2>
				<CtaRow primary={cta} page={page} />
			</div>
		</section>
	)
}

export function MockFigure({
	label,
	className,
	children,
}: {
	label: string
	className?: string
	children: React.ReactNode
}) {
	return (
		<div role="img" aria-label={label} className={className}>
			<div aria-hidden="true" className="contents">
				{children}
			</div>
		</div>
	)
}
