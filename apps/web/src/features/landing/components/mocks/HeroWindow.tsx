import { cn } from "@cortex/ui/lib/utils"
import { Check } from "lucide-react"
import { useState } from "react"
import {
	boardScene,
	heroScenes,
	heroSidebar,
	homeHero,
	taskScene,
} from "../../../../content/landing"
import { useHomeMotion, useInterval } from "../HomeMotion"
import { LinkNoteMock } from "./LinkNoteMock"

const stageClass = "animate-home-stage motion-reduce:animate-none"

const columnTones = {
	muted: "bg-text-muted",
	accent: "bg-brand",
	success: "bg-status-success",
} as const

function BoardScene() {
	return (
		<>
			<div className="mb-3.5 text-[12px] leading-none text-text-muted animate-home-stage motion-reduce:animate-none">
				{boardScene.path}
			</div>
			<div className="mb-1.5 text-[26px] leading-[1.2] font-bold tracking-[-0.015em] animate-home-stage motion-reduce:animate-none">
				{boardScene.title}
			</div>
			<div className="mt-1 mb-3.5 flex gap-1 animate-home-stage motion-reduce:animate-none">
				{boardScene.views.map((view) => (
					<span
						key={view}
						className={cn(
							"rounded-lg px-2.5 py-[5px] text-[12.5px] leading-none font-medium",
							view === boardScene.activeView ? "bg-cell text-text-primary" : "text-text-secondary",
						)}
					>
						{view}
					</span>
				))}
			</div>
			<div className="grid grid-cols-3 gap-3 animate-home-stage motion-reduce:animate-none">
				{boardScene.columns.map((column) => (
					<div key={column.name} className="flex flex-col gap-2 rounded-xl bg-cell p-2.5">
						<div className="mb-0.5 flex items-center gap-1.5 text-[12.5px] leading-none font-semibold">
							<i className={cn("size-[7px] rounded-full", columnTones[column.tone])} />
							{column.name}
						</div>
						{column.cards.map((card) => (
							<div
								key={card.title}
								className={cn(
									"rounded-[10px] bg-bg-elevated px-3 py-2.5 text-[13px] leading-[18px] font-medium shadow-ring",
									"moving" in card &&
										card.moving &&
										"relative z-[2] animate-home-move motion-reduce:animate-none",
								)}
							>
								{card.title}
								<small className="block text-[11.5px] leading-4 font-normal text-text-muted">
									{card.meta}
								</small>
							</div>
						))}
					</div>
				))}
			</div>
		</>
	)
}

function TaskScene() {
	return (
		<>
			<div className="mb-3.5 text-[12px] leading-none text-text-muted animate-home-stage motion-reduce:animate-none">
				{taskScene.path}
			</div>
			<div className="flex items-center gap-2.5 rounded-xl bg-bg-elevated px-3.5 py-3 text-[15px] leading-[22px] shadow-ring animate-home-stage motion-reduce:animate-none">
				<Check className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
				<span className="inline-block w-[38ch] overflow-hidden border-r-2 border-brand align-bottom whitespace-nowrap animate-home-typing motion-reduce:animate-none">
					{taskScene.typed}
				</span>
			</div>
			<div className="mt-2.5 mb-[18px] flex flex-wrap gap-1.5">
				{taskScene.chips.map((chip, index) => (
					<span
						key={chip}
						className="inline-flex h-[26px] items-center rounded-full bg-brand-subtle px-2.5 text-[12.5px] leading-none font-medium text-brand-text animate-home-pop motion-reduce:animate-none"
						style={{ animationDelay: `${4.6 + index * 0.4}s` }}
					>
						{chip}
					</span>
				))}
			</div>
			<div
				className="rounded-lg bg-cell px-3 py-2 font-mono text-[12.5px] leading-[18px] text-text-secondary animate-home-pop motion-reduce:animate-none"
				style={{ animationDelay: "5.8s", animationDuration: "0.6s" }}
			>
				{taskScene.line}
			</div>
			<div className="absolute right-[18px] bottom-[18px] w-[300px] rounded-[14px] bg-bg-elevated px-3.5 py-3 text-[13px] leading-[18px] shadow-lift animate-home-slide motion-reduce:animate-none">
				<b className="block font-semibold">{taskScene.toastTitle}</b>
				{taskScene.toastMeta}
				<span className="mt-2 flex gap-1.5">
					{taskScene.toastActions.map((action) => (
						<span
							key={action}
							className="rounded-md bg-cell px-2 py-1 text-[12px] leading-none font-medium"
						>
							{action}
						</span>
					))}
				</span>
			</div>
		</>
	)
}

export function HeroWindow() {
	const { isPaused, togglePaused } = useHomeMotion()
	const [scene, setScene] = useState(0)
	const [resetKey, setResetKey] = useState(0)

	useInterval(
		() => setScene((current) => (current + 1) % heroScenes.length),
		6500,
		!isPaused,
		resetKey,
	)

	function goToScene(index: number) {
		setScene(index)
		setResetKey((key) => key + 1)
	}

	const activeScene = heroScenes[scene] ?? heroScenes[0]

	return (
		<figure className="relative z-[1] m-0 min-h-[520px] overflow-hidden rounded-t-[14px] bg-sidebar text-left shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_30px_70px_-20px_rgba(30,20,30,0.45)] max-sm:w-[860px] max-sm:[zoom:0.5]">
			<figcaption className="sr-only">{homeHero.windowAlt}</figcaption>
			<div className="flex h-10 items-center gap-2 px-3.5">
				<i className="size-3 rounded-full bg-sep" aria-hidden="true" />
				<i className="size-3 rounded-full bg-sep" aria-hidden="true" />
				<i className="size-3 rounded-full bg-sep" aria-hidden="true" />
				<span className="ml-3 text-[12px] leading-none font-medium text-text-muted">
					{homeHero.windowTitle} — {activeScene.title}
				</span>
				<button
					type="button"
					className="ml-auto h-[22px] w-[26px] rounded-md text-[11px] leading-none font-medium text-text-muted opacity-60 outline-none hover:bg-bg-hover hover:opacity-100 focus-visible:opacity-100 focus-visible:shadow-focus"
					onClick={togglePaused}
					aria-pressed={isPaused}
					aria-label={isPaused ? homeHero.playLabel : homeHero.pauseLabel}
				>
					{isPaused ? "▶" : "Ⅱ"}
				</button>
			</div>
			<div className="flex min-h-[480px]">
				<nav
					className="w-[210px] shrink-0 px-2.5 pt-1.5 pb-4 font-app text-[13px] leading-4"
					aria-label="Tour"
				>
					<div className="px-2 pt-2.5 pb-1.5 text-[11px] leading-[15px] font-medium text-text-muted">
						{homeHero.windowTitle}
					</div>
					{heroSidebar.map((item) => {
						const itemClass = cn(
							"flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-left text-[13px] leading-4 text-text-primary",
							"nested" in item && item.nested && "pl-7",
						)
						if (!("scene" in item)) {
							return (
								<div key={item.label} className={itemClass}>
									{item.label}
								</div>
							)
						}
						const isActive = item.scene === scene
						return (
							<button
								key={item.label}
								type="button"
								className={cn(
									itemClass,
									"outline-none hover:bg-bg-hover focus-visible:shadow-focus",
									isActive && "bg-bg-elevated shadow-ring hover:bg-bg-elevated",
								)}
								aria-current={isActive ? "true" : undefined}
								onClick={() => goToScene(item.scene)}
							>
								{item.label}
							</button>
						)
					})}
				</nav>
				<div
					key={activeScene.id}
					className="relative mr-2.5 mb-2.5 flex-1 overflow-hidden rounded-xl bg-bg-primary px-10 py-[30px] font-app shadow-ring"
				>
					{scene === 0 ? <LinkNoteMock variant="hero" className={stageClass} /> : null}
					{scene === 1 ? <BoardScene /> : null}
					{scene === 2 ? <TaskScene /> : null}
				</div>
			</div>
		</figure>
	)
}
