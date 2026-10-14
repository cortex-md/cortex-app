import { Button } from "@cortex/ui/button"
import { cn } from "@cortex/ui/lib/utils"
import { ArrowUpRight, Check, Github, Lightbulb } from "lucide-react"
import { useState } from "react"
import {
	type RoadmapColumn,
	type RoadmapStatus,
	roadmapAreas,
	roadmapColumns,
	roadmapCopy,
	roadmapLinks,
} from "../../content/roadmap"
import { trackEvent } from "../../lib/analytics"

const focusRing = "outline-none focus-visible:shadow-focus"

const statusPillClasses: Record<RoadmapStatus, string> = {
	shipped: "bg-status-success-background text-status-success-foreground",
	"in-progress": "bg-brand-subtle text-brand-text",
	planned: "bg-cell text-text-secondary",
}

function RoadmapColumnSection({ column, area }: { column: RoadmapColumn; area: string }) {
	const items = column.items.filter((item) => area === roadmapCopy.allAreas || item.area === area)
	const headingId = `roadmap-${column.id}`

	return (
		<section className="grid gap-2.5 rounded-[18px] bg-cell p-3" aria-labelledby={headingId}>
			<div className="flex items-center gap-2 px-1 pt-1 pb-1.5">
				<h2
					id={headingId}
					className={cn(
						"inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] leading-none font-medium",
						statusPillClasses[column.id],
					)}
				>
					<span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
					{column.title}
				</h2>
				<small className="text-[13px] leading-none font-medium text-text-muted">
					{items.length}
				</small>
			</div>
			{items.map((item) => (
				<article
					key={item.title}
					className="grid gap-2 rounded-[14px] bg-bg-elevated p-4 shadow-[var(--site-ring),0_1px_2px_rgba(28,25,23,0.04)] transition-shadow duration-150 ease-out hover:shadow-[var(--site-ring),0_8px_20px_-10px_rgba(28,25,23,0.18)]"
				>
					<div className="flex items-center justify-between gap-2">
						<span className="text-[12px] leading-none font-medium text-text-muted">
							{item.area}
						</span>
						{item.release ? (
							<a
								className={cn(
									"inline-flex items-center gap-1 rounded-sm text-[12px] leading-none font-medium text-status-success-foreground hover:underline",
									focusRing,
								)}
								href={roadmapLinks.release(item.release)}
								target="_blank"
								rel="noreferrer"
							>
								<Check className="size-3" aria-hidden="true" />
								{roadmapCopy.shippedIn(item.release)}
							</a>
						) : null}
					</div>
					<h3 className="text-[15.5px] leading-[1.35] font-semibold tracking-[-0.01em] text-text-primary">
						{item.title}
					</h3>
					<p className="text-[13.5px] leading-normal text-text-secondary">{item.description}</p>
					<div className="mt-1 flex items-center justify-between">
						<a
							className={cn(
								"inline-flex min-h-8 items-center gap-1.5 rounded-sm py-1 text-[12.5px] leading-none font-medium text-text-muted hover:text-text-primary max-sm:min-h-10",
								focusRing,
							)}
							href={roadmapLinks.openIssue(item.title)}
							target="_blank"
							rel="noreferrer"
						>
							<Github className="size-3.5" aria-hidden="true" />
							{roadmapCopy.openIssue}
						</a>
					</div>
				</article>
			))}
			{items.length === 0 ? (
				<p className="px-2 py-[18px] text-center text-[13px] leading-[1.4] text-text-muted">
					{roadmapCopy.empty}
				</p>
			) : null}
		</section>
	)
}

export function RoadmapPage() {
	const [area, setArea] = useState<string>(roadmapCopy.allAreas)

	return (
		<div className="mx-auto w-[min(1180px,calc(100%-64px))] pt-[72px] max-sm:w-[calc(100%-40px)] max-sm:pt-10">
			<header>
				<h1 className="max-w-[820px] text-[clamp(36px,4.6vw,56px)] leading-[1.04] font-semibold tracking-[-0.035em] max-sm:text-[38px]">
					{roadmapCopy.title} <span className="text-text-muted">{roadmapCopy.titleQuiet}</span>
				</h1>
				<p className="mt-3.5 max-w-[620px] text-[17px] leading-[1.6] text-text-secondary max-sm:text-[16.5px]">
					{roadmapCopy.lead}
				</p>
				<div className="mt-[22px] flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[13px] leading-[1.4]">
					<a
						className={cn(
							"inline-flex min-h-8 items-center gap-1 rounded-sm text-text-secondary hover:text-text-primary",
							focusRing,
						)}
						href={roadmapLinks.issues}
						target="_blank"
						rel="noreferrer"
					>
						{roadmapCopy.issuesLink}
						<ArrowUpRight className="size-[13px]" aria-hidden="true" />
					</a>
				</div>
			</header>

			<fieldset className="min-w-0 border-0 p-0 mt-11 mb-5 flex flex-wrap gap-1.5 max-sm:mt-8 max-sm:-mr-5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pr-5 max-sm:[scrollbar-width:none]">
				<legend className="sr-only">{roadmapCopy.filterLabel}</legend>
				{roadmapAreas.map((option) => (
					<button
						key={option}
						type="button"
						className={cn(
							"h-8 shrink-0 rounded-full px-3 text-[13px] leading-none font-medium text-text-secondary shadow-[inset_0_0_0_1px_var(--site-sep)] hover:text-text-primary aria-pressed:bg-text-primary aria-pressed:text-bg-primary aria-pressed:shadow-none max-sm:h-10 max-sm:px-4",
							focusRing,
						)}
						aria-pressed={area === option}
						onClick={() => setArea(option)}
					>
						{option}
					</button>
				))}
			</fieldset>

			<div className="grid grid-cols-3 items-start gap-5 max-[1000px]:grid-cols-[minmax(0,1fr)]">
				{roadmapColumns.map((column) => (
					<RoadmapColumnSection key={column.id} column={column} area={area} />
				))}
			</div>

			<div className="mt-10 flex items-center gap-4 rounded-[18px] px-6 py-[22px] shadow-[inset_0_0_0_1px_var(--site-sep)] max-sm:flex-col max-sm:items-start">
				<span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand-text">
					<Lightbulb className="size-[18px]" aria-hidden="true" />
				</span>
				<div className="flex-1">
					<b className="text-[16px] leading-[1.3] font-semibold">{roadmapCopy.ideaTitle}</b>
					<p className="mt-1 text-[14px] leading-[1.45] text-text-secondary">
						{roadmapCopy.ideaDescription}
					</p>
				</div>
				<Button className="max-sm:w-full" asChild>
					<a
						href={roadmapLinks.suggestIdea}
						target="_blank"
						rel="noreferrer"
						onClick={() => trackEvent({ name: "roadmap_suggest_clicked" })}
					>
						{roadmapCopy.ideaCta}
					</a>
				</Button>
			</div>
		</div>
	)
}
