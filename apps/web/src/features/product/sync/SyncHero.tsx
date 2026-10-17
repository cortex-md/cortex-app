import { cn } from "@cortex/ui/lib/utils"
import { Bookmark, CalendarDays, Folder, Lock, Search } from "lucide-react"
import { syncPage } from "../../../content/product"
import { Painting } from "../../site/Painting"
import { CtaRow, MockFigure, ProductHero } from "../shared/layout"
import { PhoneFrame } from "../shared/PhoneFrame"
import { WindowDots } from "../shared/WindowDots"
import { SyncStatus, TypedLine } from "./SyncStatus"

const { hero, mock } = syncPage
const phoneTabIcons = [Folder, CalendarDays, Bookmark, Search]
const packetPath = "path('M 600 250 C 680 110, 790 100, 860 190')"

function MacWindow() {
	return (
		<div className="absolute top-[30px] left-0 grid h-[470px] w-[700px] grid-cols-[180px_1fr] grid-rows-[36px_1fr] overflow-hidden rounded-[14px] bg-sidebar text-left shadow-lift max-sm:hidden">
			<div className="col-span-full flex items-center gap-[7px] px-3">
				<WindowDots />
				<em className="ml-auto text-[11.5px] leading-none font-medium text-text-muted not-italic">
					<SyncStatus label={mock.status} />
				</em>
			</div>
			<div className="px-2.5 py-1.5 text-[12.5px] leading-none">
				<div className="px-2 py-[7px] text-[11px] text-text-muted">{mock.vault}</div>
				{mock.folders.map((folder) => (
					<div
						key={folder}
						className={cn(
							"rounded-md px-2 py-[7px]",
							folder === mock.activeFolder && "bg-bg-hover font-medium",
						)}
					>
						{folder}
					</div>
				))}
			</div>
			<div className="mr-2 mb-2 rounded-[10px] bg-bg-primary px-[34px] py-[26px] text-[14.5px] leading-6 shadow-ring">
				<h4 className="mb-1 text-[22px] leading-[1.2] font-bold">{mock.title}</h4>
				<div className="mb-3 text-[12px] leading-none text-text-muted">{mock.macMeta}</div>
				{mock.paragraphs.map((paragraph) => (
					<p key={paragraph}>{paragraph}</p>
				))}
				<p>
					<TypedLine text={mock.typed} device="mac" />
				</p>
				<div className="mt-[18px] border-sep border-t pt-3.5 text-[14px] leading-none">
					{mock.tasks.map((task) => (
						<div
							key={task.label}
							className={cn(
								"flex items-center gap-2.5 py-1.5",
								task.done && "text-text-muted line-through",
							)}
						>
							<i
								className={cn(
									"size-[15px] rounded-[4px]",
									task.done ? "bg-brand" : "shadow-[inset_0_0_0_1.5px_var(--site-sep)]",
								)}
							/>
							{task.label}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

function PhoneScreen() {
	return (
		<>
			<div className="mb-1.5 flex items-center justify-between text-[15px] leading-none text-brand-text">
				<span>{mock.phoneBack}</span>
				<SyncStatus label={mock.status} className="text-[11.5px] text-text-muted" />
			</div>
			<h4 className="mt-1.5 mb-0.5 text-[28px] leading-[1.15] font-bold tracking-[-0.02em]">
				{mock.title}
			</h4>
			<div className="mb-3 text-[12px] leading-none text-text-muted">{mock.phoneMeta}</div>
			{mock.paragraphs.map((paragraph) => (
				<p key={paragraph} className="mb-2">
					{paragraph}
				</p>
			))}
			<p className="mb-2">
				<TypedLine text={mock.typed} device="phone" />
			</p>
			<div className="absolute inset-x-3.5 bottom-[26px] flex justify-around rounded-full bg-[color-mix(in_srgb,var(--bg-elevated)_78%,transparent)] px-1.5 pt-2 pb-[7px] text-[10px] leading-none font-medium text-text-muted shadow-[0_0_0_1px_color-mix(in_srgb,var(--text-primary)_8%,transparent),0_10px_24px_-14px_rgba(0,0,0,0.35)] backdrop-blur-[18px] backdrop-saturate-[1.4]">
				{mock.phoneTabs.map((tab, index) => {
					const Icon = phoneTabIcons[index] ?? Folder
					return (
						<span
							key={tab}
							className={cn("flex flex-col items-center gap-1", index === 0 && "text-brand-text")}
						>
							<Icon className="size-5" strokeWidth={1.8} />
							{tab}
						</span>
					)
				})}
			</div>
		</>
	)
}

export function SyncHero() {
	return (
		<ProductHero title={hero.title} quiet={hero.quiet} lead={hero.lead}>
			<CtaRow primary={syncPage.primaryCta} secondary={syncPage.secondaryCta} page="sync" />
			<MockFigure
				label={mock.phoneAlt}
				className="relative isolate mt-16 overflow-hidden rounded-[28px] px-12 pt-10 pb-14 max-[1000px]:px-6 max-sm:mt-10 max-sm:rounded-[22px] max-sm:px-0 max-sm:pt-9 max-sm:pb-10"
			>
				<Painting name="coast" position="center 50%" priority />
				<div className="relative z-[1] h-[600px] max-[1000px]:w-[1064px] max-[1000px]:[zoom:0.7] max-sm:h-auto max-sm:w-auto max-sm:[zoom:1]">
					<MacWindow />
					<span
						className="absolute z-[3] inline-flex size-[34px] items-center justify-center rounded-full bg-bg-elevated text-brand-text opacity-0 shadow-lift animate-product-packet [offset-rotate:0deg] motion-reduce:hidden max-sm:hidden"
						style={{ offsetPath: packetPath }}
					>
						<Lock className="size-4" />
					</span>
					<PhoneFrame className="absolute top-1.5 right-10 max-sm:relative max-sm:top-auto max-sm:right-auto max-sm:mx-auto max-sm:[zoom:0.84]">
						<PhoneScreen />
					</PhoneFrame>
				</div>
			</MockFigure>
		</ProductHero>
	)
}
