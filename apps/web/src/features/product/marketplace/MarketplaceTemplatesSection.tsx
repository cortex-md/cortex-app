import { cn } from "@cortex/ui/lib/utils"
import { Check, FileText, Search, Sheet } from "lucide-react"
import type React from "react"
import { marketplacePage } from "../../../content/product"
import { revealClass } from "../../site/motion"
import { Painting } from "../../site/Painting"
import { CheckList, GroupHeading, MockFigure, ProductSection } from "../shared/layout"

const { templates } = marketplacePage
const { weekly, projects } = templates

const rowAnimations = [
	{ row: "animate-product-row-a", use: "animate-product-use-a" },
	{ row: "animate-product-row-b", use: "animate-product-use-b" },
]
const tableRowAnimations = [
	"animate-product-table-row-1",
	"animate-product-table-row-2",
	"animate-product-table-row-3",
]
const pillTones = {
	rose: "bg-[#ffe4e6] text-[#be123c]",
	amber: "bg-[#fdf0d5] text-[#92590a]",
	neutral: "bg-[#eeece9] text-[#44403c]",
} as const
const sectionAnimations = [
	"animate-product-section-1",
	"animate-product-section-2",
	"animate-product-section-3",
]

function Pill({ tone, children }: { tone: keyof typeof pillTones; children: React.ReactNode }) {
	return (
		<em
			className={cn(
				"inline-block justify-self-start rounded-md px-2 py-[3px] text-[12px] leading-[1.2] font-medium not-italic",
				pillTones[tone],
			)}
		>
			{children}
		</em>
	)
}

function SourceChip({ name, detail }: { name: string; detail: string }) {
	return (
		<div className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf4f0] px-2.5 py-[5px] text-[12px] text-[#2f6f57]">
			<Check className="size-[13px]" />
			Created from <b className="font-semibold">{name}</b>
			{detail}
		</div>
	)
}

function FilledValue({
	chip,
	value,
	chipAnimation,
	valueAnimation,
}: {
	chip: string
	value: string
	chipAnimation: string
	valueAnimation: string
}) {
	return (
		<span className="inline-flex items-baseline align-baseline">
			<em
				className={cn(
					"max-w-[220px] overflow-hidden rounded-md bg-[#ffe4e6] px-2 py-0.5 text-[13px] leading-[1.4] font-medium whitespace-nowrap text-[#be123c] not-italic motion-reduce:hidden",
					chipAnimation,
				)}
			>
				{chip}
			</em>
			<b
				className={cn(
					"max-w-0 overflow-hidden whitespace-nowrap opacity-0 [font-weight:inherit] motion-reduce:max-w-none motion-reduce:animate-none motion-reduce:opacity-100",
					valueAnimation,
				)}
			>
				{value}
			</b>
		</span>
	)
}

function WeeklyScene() {
	return (
		<div className="absolute inset-0 px-[34px] py-[22px] opacity-0 animate-product-scene-a motion-reduce:animate-none motion-reduce:opacity-100">
			<SourceChip name={weekly.source} detail={weekly.sourceDetail} />
			<h4 className="mt-4 mb-3 text-[26px] leading-[1.2] font-bold tracking-[-0.01em]">
				{weekly.titleBefore}
				<FilledValue
					chip={weekly.weekChip}
					value={weekly.weekValue}
					chipAnimation="animate-product-chip-week"
					valueAnimation="animate-product-value-week"
				/>
				{weekly.titleAfter}
			</h4>
			<div className="mb-3.5 grid gap-0.5 border-b border-[#e8e5e1] pb-3">
				<div className="grid min-h-7 grid-cols-[90px_1fr] items-center">
					<span className="text-[#8a847d]">{weekly.dateLabel}</span>
					<FilledValue
						chip={weekly.dateChip}
						value={weekly.dateValue}
						chipAnimation="animate-product-chip-date"
						valueAnimation="animate-product-value-date"
					/>
				</div>
				<div className="grid min-h-7 grid-cols-[90px_1fr] items-center">
					<span className="text-[#8a847d]">{weekly.statusLabel}</span>
					<Pill tone="rose">{weekly.status}</Pill>
				</div>
				<div className="grid min-h-7 grid-cols-[90px_1fr] items-center">
					<span className="text-[#8a847d]">{weekly.tagsLabel}</span>
					<Pill tone="neutral">{weekly.tag}</Pill>
				</div>
			</div>
			{weekly.sections.map((section, index) => (
				<div
					key={section.title}
					className={cn(
						"opacity-0 motion-reduce:animate-none motion-reduce:opacity-100",
						sectionAnimations[index],
					)}
				>
					<h5 className="mb-1 text-[15px] leading-[1.3] font-semibold">{section.title}</h5>
					{"body" in section ? (
						<p className="mb-2.5 text-[14px] leading-[22px] text-[#a8a29e]">{section.body}</p>
					) : null}
					{"tasks" in section
						? section.tasks.map((task, taskIndex) => (
								<div
									key={task}
									className={cn(
										"flex items-center gap-2.5 py-0.5 text-[14px] leading-[22px]",
										taskIndex === section.tasks.length - 1 && "mb-2.5",
									)}
								>
									<i className="size-3.5 rounded-[4px] shadow-[inset_0_0_0_1.5px_#d6d3d1]" />
									{task}
								</div>
							))
						: null}
				</div>
			))}
		</div>
	)
}

function ProjectsScene() {
	return (
		<div className="absolute inset-0 px-[34px] py-[22px] opacity-0 animate-product-scene-b motion-reduce:hidden">
			<SourceChip name={projects.source} detail={projects.sourceDetail} />
			<h4 className="mt-4 mb-3 text-[26px] leading-[1.2] font-bold tracking-[-0.01em]">
				{projects.title}
			</h4>
			<div className="relative mb-1 flex gap-[18px] border-b border-[#e8e5e1] font-medium text-[#8a847d]">
				<span className="py-2 animate-product-view-table">{projects.views[0]}</span>
				<span className="py-2 animate-product-view-board">{projects.views[1]}</span>
				<span className="py-2">{projects.views[2]}</span>
				<i className="absolute -bottom-px left-0 h-0.5 w-[38px] bg-[#1c1917] animate-product-view-underline" />
			</div>
			<div className="absolute inset-x-[34px] top-[150px] animate-product-table">
				<div className="grid min-h-8 grid-cols-[1.6fr_1.1fr_0.7fr_0.7fr] items-center border-b border-[#eeece9] text-[12px] text-[#8a847d]">
					{projects.columns.map((column) => (
						<span key={column}>{column}</span>
					))}
				</div>
				{projects.rows.map((row, index) => (
					<div
						key={row.name}
						className={cn(
							"grid min-h-10 grid-cols-[1.6fr_1.1fr_0.7fr_0.7fr] items-center border-b border-[#eeece9] opacity-0",
							tableRowAnimations[index],
						)}
					>
						<span className="font-medium">{row.name}</span>
						<span>
							<Pill tone={row.tone}>{row.status}</Pill>
						</span>
						<span>
							<i className="inline-flex size-6 items-center justify-center rounded-full bg-[#fda4af] text-[9.5px] leading-none font-semibold text-white not-italic">
								{row.owner}
							</i>
						</span>
						<span>{row.due}</span>
					</div>
				))}
			</div>
			<div className="absolute inset-x-[34px] top-40 grid grid-cols-4 gap-3 opacity-0 animate-product-board">
				{projects.board.map((column) => {
					const card = projects.rows.find((row) => row.status === column)
					return (
						<div key={column} className="min-h-[220px] rounded-[10px] bg-[#f6f5f3] p-2.5">
							<h6 className="mb-2.5 text-[12px] leading-none font-medium text-[#8a847d]">
								{column}
							</h6>
							{card ? (
								<div className="flex flex-col gap-1.5 rounded-lg bg-white p-2.5 font-medium shadow-[0_0_0_1px_#e8e5e1,0_2px_6px_-3px_rgba(0,0,0,0.12)]">
									{card.name}
									<small className="text-[11.5px] font-normal text-[#8a847d]">{card.due}</small>
								</div>
							) : null}
						</div>
					)
				})}
			</div>
		</div>
	)
}

function TemplatesWindow() {
	return (
		<div className="relative mx-auto flex h-[470px] max-w-[1000px] flex-col overflow-hidden rounded-t-[14px] bg-[#f6f5f3] text-left text-[13px] leading-[1.3] text-[#1c1917] shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_30px_70px_-20px_rgba(30,20,30,0.45)] max-[1000px]:m-0 max-[1000px]:w-[1000px] max-[1000px]:max-w-none max-[1000px]:[zoom:0.62] max-sm:[zoom:0.5]">
			<div className="flex h-[38px] flex-none items-center gap-[7px] px-3.5">
				<i className="size-[11px] rounded-full bg-[#e8e5e1]" />
				<i className="size-[11px] rounded-full bg-[#e8e5e1]" />
				<i className="size-[11px] rounded-full bg-[#e8e5e1]" />
				<span className="ml-3 font-medium text-[#8a847d]">{templates.window}</span>
			</div>
			<div className="grid min-h-0 flex-1 grid-cols-[280px_1fr]">
				<aside className="px-3 py-1">
					<div className="mb-3 flex h-8 items-center gap-2 rounded-lg bg-[#fcfcfb] px-2.5 text-[#8a847d] shadow-[0_0_0_1px_#e8e5e1]">
						<Search className="size-3.5" />
						<span>{templates.search}</span>
					</div>
					{templates.rows.map((row, index) => {
						const Icon = row.kind === "database" ? Sheet : FileText
						const animation = rowAnimations[index]
						return (
							<div
								key={row.name}
								className={cn(
									"flex items-center gap-2.5 rounded-[9px] px-2 py-[9px] motion-reduce:animate-none",
									animation?.row,
								)}
							>
								<span className="inline-flex size-[30px] flex-none items-center justify-center rounded-lg bg-white text-[#57534e] shadow-[0_0_0_1px_#e8e5e1]">
									<Icon className="size-[15px]" />
								</span>
								<span className="flex flex-1 flex-col gap-[3px]">
									<b className="font-medium">{row.name}</b>
									<small className="text-[11.5px] text-[#8a847d]">{row.detail}</small>
								</span>
								<span
									className={cn(
										"rounded-[7px] bg-[#e11d48] px-2.5 py-[5px] text-[12px] font-medium text-white opacity-0 motion-reduce:animate-none",
										animation?.use,
									)}
								>
									{templates.use}
								</span>
							</div>
						)
					})}
				</aside>
				<section className="relative mr-2 overflow-hidden rounded-t-[10px] bg-[#fcfcfb] shadow-[0_0_0_1px_#e8e5e1]">
					<WeeklyScene />
					<ProjectsScene />
				</section>
			</div>
		</div>
	)
}

export function MarketplaceTemplatesSection() {
	return (
		<ProductSection>
			<GroupHeading title={templates.title} quiet={templates.quiet} body={templates.body} />
			<MockFigure
				label={templates.alt}
				className={cn(
					"relative isolate mt-14 overflow-hidden rounded-[28px] px-16 pt-14 max-[1000px]:px-8 max-[1000px]:pt-10 max-sm:mt-9 max-sm:rounded-[22px] max-sm:pt-7 max-sm:pr-0 max-sm:pl-5",
					revealClass,
				)}
			>
				<Painting name="dawn" position="center 45%" />
				<div className="relative z-[1]">
					<TemplatesWindow />
				</div>
			</MockFigure>
			<CheckList
				items={templates.facts}
				tone="secondary"
				className={cn(
					"mt-7 flex flex-wrap justify-center gap-x-8 gap-y-2.5 max-sm:flex-col max-sm:items-start",
					revealClass,
				)}
			/>
		</ProductSection>
	)
}
