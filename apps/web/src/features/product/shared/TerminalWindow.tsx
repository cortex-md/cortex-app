import { cn } from "@cortex/ui/lib/utils"

export type TerminalTone = "plain" | "muted" | "ok" | "accent" | "warn"

export type TerminalLine =
	| { kind: "command"; cwd: string; text: string }
	| { kind: "output"; parts: ReadonlyArray<{ tone: TerminalTone; text: string }> }

const toneClasses: Record<TerminalTone, string> = {
	plain: "",
	muted: "text-[#78716c]",
	ok: "text-[#86efac]",
	accent: "text-[#fda4af]",
	warn: "text-[#fcd34d]",
}

const lineClass =
	"whitespace-pre opacity-0 animate-product-line-show motion-reduce:animate-none motion-reduce:opacity-100"

function scheduleLines(lines: readonly TerminalLine[]) {
	let time = 0.3
	const schedule = lines.map((line) => {
		if (line.kind === "command") {
			const commandDelay = time + 0.2
			const duration = Math.max(0.9, line.text.length * 0.045)
			const entry = { delay: time, commandDelay, duration }
			time = commandDelay + duration + 0.4
			return entry
		}
		const entry = { delay: time, commandDelay: 0, duration: 0 }
		time += 0.35
		return entry
	})
	return { schedule, end: time }
}

function lineKey(line: TerminalLine) {
	return line.kind === "command"
		? `command:${line.cwd}:${line.text}`
		: `output:${line.parts.map((part) => part.text).join("")}`
}

function withOffsets(parts: ReadonlyArray<{ tone: TerminalTone; text: string }>) {
	let offset = 0
	return parts.map((part) => {
		const entry = { ...part, offset }
		offset += part.text.length
		return entry
	})
}

function Prompt({ cwd }: { cwd: string }) {
	return (
		<>
			<span className="text-[#86efac]">{cwd}</span> <span className="text-[#93c5fd]">❯</span>{" "}
		</>
	)
}

export function TerminalWindow({
	title,
	lines,
	finalCwd,
	className,
}: {
	title: string
	lines: readonly TerminalLine[]
	finalCwd: string
	className?: string
}) {
	const { schedule, end } = scheduleLines(lines)

	return (
		<div
			className={cn(
				"mx-auto max-w-[1040px] overflow-hidden rounded-[14px] bg-[#1a1817] text-left shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]",
				className,
			)}
		>
			<div className="flex h-10 items-center gap-2 bg-[#262321] px-3.5">
				<i className="size-3 rounded-full bg-[#ff5f57]" />
				<i className="size-3 rounded-full bg-[#febc2e]" />
				<i className="size-3 rounded-full bg-[#28c840]" />
				<span className="mx-auto -translate-x-[30px] text-[12.5px] leading-none font-medium text-[#a8a29e]">
					{title}
				</span>
			</div>
			<div className="min-h-[400px] px-[22px] pt-[18px] pb-6 font-mono text-[14px] leading-[23px] text-[#e7e5e4]">
				{lines.map((line, index) => {
					const timing = schedule[index]
					return (
						<div
							key={lineKey(line)}
							className={lineClass}
							style={{ animationDelay: `${timing?.delay ?? 0}s` }}
						>
							{line.kind === "command" ? (
								<>
									<Prompt cwd={line.cwd} />
									<span
										className="inline-block max-w-0 overflow-hidden align-bottom animate-product-command motion-reduce:max-w-none motion-reduce:animate-none"
										style={{
											animationDelay: `${timing?.commandDelay ?? 0}s`,
											animationDuration: `${(timing?.duration ?? 1).toFixed(2)}s`,
										}}
									>
										{line.text}
									</span>
								</>
							) : (
								withOffsets(line.parts).map((part) => (
									<span key={part.offset} className={toneClasses[part.tone]}>
										{part.text}
									</span>
								))
							)}
						</div>
					)
				})}
				<div className={lineClass} style={{ animationDelay: `${end}s` }}>
					<Prompt cwd={finalCwd} />
					<span className="inline-block h-[17px] w-[9px] bg-[#e7e5e4] align-[-3px] animate-product-caret motion-reduce:animate-none" />
				</div>
			</div>
		</div>
	)
}
