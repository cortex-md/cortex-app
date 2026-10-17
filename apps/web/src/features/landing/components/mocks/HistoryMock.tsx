import { cn } from "@cortex/ui/lib/utils"
import { useState } from "react"
import { historyMock } from "../../../../content/landing"
import { miniButtonClass, miniToastClass } from "./TasksMock"

type DiffKind = "ctx" | "add" | "del"

interface HistoryVersion {
	time: string
	who: string
	day: string
	diff: ReadonlyArray<readonly [string, string]>
}

const diffClasses: Record<DiffKind, string> = {
	ctx: "text-text-secondary",
	add: "bg-[color-mix(in_srgb,var(--status-success)_14%,transparent)]",
	del: "bg-[color-mix(in_srgb,var(--status-error)_12%,transparent)] line-through decoration-[color-mix(in_srgb,var(--text-primary)_40%,transparent)]",
}

const diffGlyphs: Record<DiffKind, string> = { ctx: "", add: "+", del: "−" }

export function HistoryMock() {
	const [selected, setSelected] = useState(0)
	const [tab, setTab] = useState<"changes" | "full">("changes")
	const [restored, setRestored] = useState<number | null>(null)
	const versions: ReadonlyArray<HistoryVersion> = historyMock.versions
	const restoredVersion = restored === null ? null : versions[restored]
	const list: ReadonlyArray<HistoryVersion> = restoredVersion
		? [
				{
					time: "Now",
					who: `Restored from ${restoredVersion.time}`,
					day: "Today",
					diff: restoredVersion.diff,
				},
				...versions,
			]
		: versions
	const selectedIndex = Math.min(selected, list.length - 1)
	const current = list[selectedIndex] ?? versions[0]
	const isNow = selectedIndex === 0
	const lines =
		tab === "full"
			? historyMock.fullNote.map((text) => ({ kind: "ctx" as DiffKind, text }))
			: (current?.diff ?? []).map(([kind, text]) => ({ kind: kind as DiffKind, text }))

	function restore() {
		if (isNow) return
		setRestored(restored !== null ? selectedIndex - 1 : selectedIndex)
		setSelected(0)
		setTab("changes")
	}

	return (
		<div className="absolute inset-[22px] bottom-10 grid grid-cols-[170px_1fr] gap-3.5 font-app">
			<div
				className="flex flex-col gap-0.5 text-[12.5px] leading-[1.2]"
				role="listbox"
				aria-label="Versions"
			>
				{list.map((version, index) => (
					<div key={`${version.time}-${version.who}`} className="contents">
						{index === 0 || list[index - 1]?.day !== version.day ? (
							<div className="px-2 pt-2.5 pb-1 text-[11.5px] leading-none font-medium text-text-muted">
								{version.day}
							</div>
						) : null}
						<button
							type="button"
							aria-pressed={index === selectedIndex}
							className="rounded-[9px] px-2.5 py-2 text-left outline-none hover:bg-cell focus-visible:shadow-focus aria-pressed:bg-bg-elevated aria-pressed:shadow-ring"
							onClick={() => setSelected(index)}
						>
							<b className="block font-medium">{version.time}</b>
							<span className="text-[11.5px] text-text-muted">{version.who}</span>
						</button>
					</div>
				))}
			</div>
			<div className="flex flex-col overflow-hidden rounded-[14px] bg-bg-elevated shadow-ring">
				<div className="flex items-center gap-1 border-sep border-b px-3 py-2.5">
					{(["changes", "full"] as const).map((option) => (
						<button
							key={option}
							type="button"
							aria-pressed={tab === option}
							className="rounded-[7px] px-[9px] py-[5px] text-[12px] leading-none font-medium text-text-secondary outline-none focus-visible:shadow-focus aria-pressed:bg-cell aria-pressed:text-text-primary"
							onClick={() => setTab(option)}
						>
							{option === "changes" ? historyMock.changesLabel : historyMock.fullLabel}
						</button>
					))}
					<em className="ml-auto text-[12px] leading-none text-text-muted not-italic">
						{historyMock.file}
					</em>
				</div>
				<div
					key={`${selectedIndex}-${tab}-${restored}`}
					className="flex-1 py-2.5 text-[13px] leading-[22px]"
				>
					{lines.map((line, index) => (
						<div
							key={`${line.kind}-${line.text}`}
							className={cn(
								"flex gap-2.5 px-3.5 py-px animate-home-pop motion-reduce:animate-none",
								diffClasses[line.kind],
							)}
							style={{
								animationDelay: `${[0, 0.4, 0.8, 1.1, 1.4, 1.8][index] ?? 1.8}s`,
								animationDuration: "0.5s",
							}}
						>
							<i className="w-2.5 shrink-0 text-text-muted not-italic">{diffGlyphs[line.kind]}</i>
							{line.text}
						</div>
					))}
				</div>
				<div className="flex items-center gap-2.5 border-sep border-t px-3 py-2.5 text-[12px] leading-[1.3] text-text-muted">
					<span>
						{isNow ? historyMock.pickHint : `${current?.who} · ${current?.day}, ${current?.time}`}
					</span>
					<button
						type="button"
						aria-disabled={isNow}
						className={cn(
							miniButtonClass,
							"ml-auto rounded-full whitespace-nowrap",
							isNow
								? "bg-cell text-text-muted"
								: "bg-brand text-text-on-accent animate-home-pulse motion-reduce:animate-none",
						)}
						onClick={restore}
					>
						{isNow ? historyMock.currentLabel : historyMock.restoreLabel}
					</button>
				</div>
			</div>
			{restoredVersion ? (
				<div
					className={cn(miniToastClass, "-bottom-8 left-1/2 -translate-x-1/2")}
					aria-live="polite"
				>
					Restored the {restoredVersion.time} version — today’s text was saved first
					<button
						type="button"
						className={cn(miniButtonClass, "bg-bg-primary/15 text-inherit")}
						onClick={() => {
							setRestored(null)
							setSelected(0)
						}}
					>
						{historyMock.undoLabel}
					</button>
				</div>
			) : null}
		</div>
	)
}
