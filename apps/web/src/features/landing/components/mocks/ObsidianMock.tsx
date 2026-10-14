import { cn } from "@cortex/ui/lib/utils"
import { Gem } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { obsidianMock } from "../../../../content/landing"
import { CortexMark } from "../../../site/CortexMark"
import { miniButtonClass } from "./TasksMock"

type ImportMode = "auto" | "run" | "done"

const paneClass =
	"flex flex-col gap-1 rounded-[14px] bg-bg-elevated p-3.5 text-[13px] leading-[1.2] shadow-ring"
const entryClass = "rounded-[7px] bg-cell px-2 py-1.5"

export function ObsidianMock() {
	const [mode, setMode] = useState<ImportMode>("auto")
	const [progress, setProgress] = useState(0)
	const timers = useRef<{ interval?: number; timeout?: number }>({})

	useEffect(
		() => () => {
			window.clearInterval(timers.current.interval)
			window.clearTimeout(timers.current.timeout)
		},
		[],
	)

	function runImport() {
		if (mode === "run") return
		window.clearInterval(timers.current.interval)
		window.clearTimeout(timers.current.timeout)
		setMode("run")
		setProgress(0)
		let value = 0
		timers.current.interval = window.setInterval(() => {
			value = Math.min(100, value + 4)
			setProgress(value)
			if (value >= 100) {
				window.clearInterval(timers.current.interval)
				setMode("done")
				timers.current.timeout = window.setTimeout(() => {
					setMode("auto")
					setProgress(0)
				}, 2500)
			}
		}, 120)
	}

	const copiedCount =
		mode === "done" ? obsidianMock.copiedEntries.length : Math.floor(progress / 20)
	const status =
		mode === "run"
			? `Copying… ${Math.round((obsidianMock.totalFiles * progress) / 100).toLocaleString("en-US")} of ${obsidianMock.totalFiles.toLocaleString("en-US")} files`
			: obsidianMock.summary
	const cta =
		mode === "run"
			? obsidianMock.runningLabel
			: mode === "done"
				? obsidianMock.againLabel
				: obsidianMock.importLabel

	return (
		<div className="absolute inset-6 grid grid-cols-[1fr_60px_1fr] grid-rows-[1fr_auto] gap-y-3.5 font-app">
			<div className={paneClass}>
				<div className="mb-2 flex items-center gap-2 font-sans text-[14px] leading-none font-semibold">
					<Gem className="size-4 text-home-violet" aria-hidden="true" />
					{obsidianMock.sourceName}
					<small className="font-app text-[12px] font-normal text-text-muted">
						{obsidianMock.sourceApp}
					</small>
				</div>
				{obsidianMock.sourceEntries.map((entry) => (
					<div key={entry} className={entryClass}>
						{entry}
					</div>
				))}
			</div>
			<div className="flex items-center" aria-hidden="true">
				<span className="mx-2 h-0.5 w-full bg-[repeating-linear-gradient(90deg,var(--text-muted)_0_6px,transparent_6px_12px)] bg-[length:24px_2px] animate-home-march motion-reduce:animate-none" />
			</div>
			<div className={paneClass}>
				<div className="mb-2 flex items-center gap-2 font-sans text-[14px] leading-none font-semibold">
					<CortexMark className="size-[18px] rounded-[5px]" size={18} />
					{obsidianMock.targetName}
					<small className="font-app text-[12px] font-normal text-text-muted">
						{obsidianMock.targetApp}
					</small>
				</div>
				{mode === "auto" ? (
					<>
						{obsidianMock.copiedEntries.map((entry, index) => (
							<div
								key={entry}
								className={cn(entryClass, "animate-home-ov-in motion-reduce:animate-none")}
								style={{ animationDelay: `${0.6 + index * 0.7}s` }}
							>
								{entry}
							</div>
						))}
						<p className="mt-auto text-[12px] leading-[1.3] font-medium text-status-success-foreground animate-home-ov-ok motion-reduce:animate-none">
							{obsidianMock.moved}
						</p>
					</>
				) : (
					<>
						{obsidianMock.copiedEntries.slice(0, copiedCount).map((entry) => (
							<div
								key={entry}
								className={cn(entryClass, "animate-home-pop motion-reduce:animate-none")}
							>
								{entry}
							</div>
						))}
						{mode === "done" ? (
							<p className="mt-auto text-[12px] leading-[1.3] font-medium text-status-success-foreground animate-home-pop motion-reduce:animate-none">
								{obsidianMock.moved}
							</p>
						) : null}
					</>
				)}
			</div>
			<div className="col-span-full flex flex-col gap-2 text-[12.5px] leading-[1.3] text-text-muted">
				<div className="h-1.5 overflow-hidden rounded-md bg-cell">
					<i
						className={cn(
							"block h-full bg-brand",
							mode === "auto"
								? "animate-home-fill motion-reduce:animate-none"
								: "transition-[width] duration-[120ms] ease-linear",
						)}
						style={mode === "auto" ? undefined : { width: `${progress}%` }}
					/>
				</div>
				<div className="flex items-center gap-2.5">
					<span className="flex-1">{status}</span>
					<button
						type="button"
						className={cn(
							miniButtonClass,
							mode === "run" ? "bg-cell text-text-muted" : "bg-brand text-text-on-accent",
						)}
						onClick={runImport}
					>
						{cta}
					</button>
				</div>
			</div>
		</div>
	)
}
