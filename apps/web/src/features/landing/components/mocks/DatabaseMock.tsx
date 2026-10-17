import { cn } from "@cortex/ui/lib/utils"
import { useState } from "react"
import { databaseMock } from "../../../../content/landing"
import { useHomeMotion, useInterval } from "../HomeMotion"

type DatabaseView = (typeof databaseMock.views)[number]["id"]

const viewOrder: DatabaseView[] = ["table", "board", "gallery"]

const cardLayouts: Record<
	DatabaseView,
	Array<{ top: number; left: string; width: string; height: number; band: number }>
> = {
	table: [0, 1, 2, 3, 4].map((index) => ({
		top: 22 + index * 44,
		left: "0%",
		width: "100%",
		height: 38,
		band: 0,
	})),
	board: [
		{ top: 24, left: "34%", width: "32%", height: 66, band: 0 },
		{ top: 24, left: "0%", width: "32%", height: 66, band: 0 },
		{ top: 24, left: "68%", width: "32%", height: 66, band: 0 },
		{ top: 100, left: "34%", width: "32%", height: 66, band: 0 },
		{ top: 100, left: "0%", width: "32%", height: 66, band: 0 },
	],
	gallery: [
		{ top: 0, left: "0%", width: "32%", height: 128, band: 54 },
		{ top: 0, left: "34%", width: "32%", height: 128, band: 54 },
		{ top: 0, left: "68%", width: "32%", height: 128, band: 54 },
		{ top: 140, left: "0%", width: "32%", height: 128, band: 54 },
		{ top: 140, left: "34%", width: "32%", height: 128, band: 54 },
	],
}

const statusTones = {
	progress: "text-brand-text",
	backlog: "text-text-muted",
	done: "text-status-success-foreground",
} as const

const easeClass = "ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"

export function DatabaseMock() {
	const { isPaused } = useHomeMotion()
	const [view, setView] = useState<DatabaseView>("table")
	const [selected, setSelected] = useState(0)
	const [resetKey, setResetKey] = useState(0)
	const viewIndex = viewOrder.indexOf(view)

	useInterval(
		() =>
			setView(
				(current) => viewOrder[(viewOrder.indexOf(current) + 1) % viewOrder.length] ?? "table",
			),
		4300,
		!isPaused,
		resetKey,
	)

	return (
		<div className="absolute inset-[22px] flex flex-col font-app">
			<div className="mb-4 flex items-center gap-3">
				<b className="text-[20px] leading-none font-bold">{databaseMock.title}</b>
				<span className="text-[12px] leading-none text-text-muted">{databaseMock.hint}</span>
				<span
					className="relative ml-auto inline-flex rounded-[10px] bg-cell p-[3px]"
					role="tablist"
					aria-label="View"
				>
					{databaseMock.views.map((option) => (
						<button
							key={option.id}
							type="button"
							role="tab"
							aria-selected={view === option.id}
							className="relative z-[1] w-[78px] rounded-lg py-1.5 text-[12.5px] leading-none font-medium text-text-secondary outline-none focus-visible:shadow-focus aria-selected:text-text-primary"
							onClick={() => {
								setView(option.id)
								setResetKey((key) => key + 1)
							}}
						>
							{option.label}
						</button>
					))}
					<i
						className={cn(
							"absolute top-[3px] left-[3px] h-[calc(100%-6px)] w-[78px] rounded-lg bg-bg-elevated shadow-ring transition-transform duration-500",
							easeClass,
						)}
						style={{ transform: `translateX(${viewIndex * 78}px)` }}
						aria-hidden="true"
					/>
				</span>
			</div>
			<div className="relative flex-1">
				<div
					className={cn(
						"absolute inset-x-0 top-0 grid grid-cols-[1fr_120px_70px] px-3.5 text-[11.5px] leading-none font-medium text-text-muted transition-opacity duration-[400ms]",
						view === "table" ? "opacity-100" : "opacity-0",
					)}
					aria-hidden="true"
				>
					{databaseMock.tableHeaders.map((header) => (
						<span key={header}>{header}</span>
					))}
				</div>
				<div
					className={cn(
						"absolute inset-x-0 top-0 grid grid-cols-3 gap-[2%] text-[11.5px] leading-none font-medium text-text-muted transition-opacity duration-[400ms]",
						view === "board" ? "opacity-100" : "opacity-0",
					)}
					aria-hidden="true"
				>
					{databaseMock.boardColumns.map((column) => (
						<span key={column}>{column}</span>
					))}
				</div>
				{databaseMock.rows.map((row, index) => {
					const layout = cardLayouts[view][index] ?? cardLayouts.table[0]
					return (
						<button
							key={row.name}
							type="button"
							aria-pressed={selected === index}
							className={cn(
								"absolute flex flex-wrap content-start items-center gap-x-2.5 gap-y-1.5 overflow-hidden rounded-[10px] bg-bg-elevated px-3.5 pb-2.5 text-left text-[13px] leading-[1.2] font-medium shadow-ring outline-none transition-[top,left,width,height,padding] duration-[600ms] focus-visible:shadow-focus aria-pressed:shadow-[0_0_0_1.5px_var(--accent)]",
								easeClass,
							)}
							style={{
								top: layout.top,
								left: layout.left,
								width: layout.width,
								height: layout.height,
								paddingTop: 10 + layout.band,
							}}
							onClick={() => setSelected(index)}
						>
							<span
								className={cn(
									"absolute inset-x-0 top-0 bg-[linear-gradient(color-mix(in_srgb,var(--accent)_22%,var(--bg-primary)),color-mix(in_srgb,var(--accent)_8%,var(--bg-primary)))] transition-[height] duration-[600ms]",
									easeClass,
								)}
								style={{ height: layout.band }}
								aria-hidden="true"
							/>
							<b className="flex-[1_0_150px] font-medium">{row.name}</b>
							<span
								className={cn(
									"inline-flex w-[104px] items-center gap-[5px] text-[12px] leading-none font-medium before:size-[7px] before:rounded-full before:bg-current",
									statusTones[row.tone],
								)}
							>
								{row.status}
							</span>
							<small className="w-[52px] text-[12px] leading-none font-normal text-text-muted">
								{row.due}
							</small>
						</button>
					)
				})}
			</div>
		</div>
	)
}
