import { cn } from "@cortex/ui/lib/utils"
import { Lock } from "lucide-react"
import { useState } from "react"
import { collaborationMock } from "../../../../content/landing"
import { miniButtonClass } from "./TasksMock"

type Person = (typeof collaborationMock.people)[number]["id"]

const personColors: Record<Person | "you", string> = {
	ana: "bg-brand",
	bruno: "bg-home-violet",
	carla: "bg-home-green",
	you: "bg-home-blue",
}

const avatarClass =
	"inline-flex size-[22px] shrink-0 items-center justify-center rounded-full text-[9px] leading-none font-semibold text-white not-italic"

function Caret({
	person,
	name,
	dimmed,
	focused,
}: {
	person: Person | "you"
	name: string
	dimmed?: boolean
	focused?: boolean
}) {
	return (
		<span
			className={cn(
				"relative mx-px inline-block h-[1.15em] w-0.5 rounded-[1px] align-[-0.18em] transition-opacity",
				personColors[person],
				dimmed && "opacity-25",
			)}
		>
			<b
				className={cn(
					"absolute bottom-full left-0 rounded-[5px_5px_5px_0] px-1.5 font-app text-[10.5px] leading-[15px] font-semibold whitespace-nowrap text-white",
					personColors[person],
					focused && "shadow-[0_0_0_3px_var(--accent-subtle)]",
				)}
			>
				{name}
			</b>
		</span>
	)
}

export function CollaborationMock() {
	const [follow, setFollow] = useState<Person | null>(null)
	const [isCommentOpen, setIsCommentOpen] = useState(false)
	const [replies, setReplies] = useState<Array<{ id: number; text: string }>>([])
	const [reply, setReply] = useState("")
	const [lines, setLines] = useState<Array<{ id: number; text: string }>>([])
	const [line, setLine] = useState("")
	const followed = collaborationMock.people.find((person) => person.id === follow)
	const visibleLines = line ? [...lines, { id: -1, text: line }] : lines

	function sendReply() {
		const value = reply.trim()
		if (!value) return
		setReplies((current) => [...current, { id: Date.now(), text: value }])
		setReply("")
	}

	function addLine() {
		const value = line.trim()
		if (!value) return
		setLines((current) => [...current, { id: Date.now(), text: value }])
		setLine("")
	}

	return (
		<div className="absolute inset-[22px] flex flex-col overflow-hidden rounded-[14px] bg-bg-primary font-app shadow-ring">
			<div className="flex items-center gap-2.5 border-sep border-b px-3.5 py-2.5 text-[13px] leading-none font-medium">
				<b className="font-medium">{collaborationMock.title}</b>
				<span className="ml-auto inline-flex">
					{collaborationMock.people.map((person) => (
						<button
							key={person.id}
							type="button"
							aria-pressed={follow === person.id}
							aria-label={`Follow ${person.name}`}
							className={cn(
								"-ml-[5px] inline-flex size-6 items-center justify-center rounded-full border-0 text-[9px] leading-none font-semibold text-white shadow-[0_0_0_2px_var(--bg-primary)] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus aria-pressed:outline-2 aria-pressed:outline-offset-1 aria-pressed:outline-text-primary",
								personColors[person.id],
							)}
							onClick={() => setFollow((current) => (current === person.id ? null : person.id))}
						>
							{person.initials}
						</button>
					))}
				</span>
				{followed ? (
					<span className="inline-flex items-center gap-2 rounded-full bg-brand-subtle py-[3px] pr-1 pl-2.5 text-[12px] leading-none font-medium text-brand-text">
						Following {followed.name}
						<button
							type="button"
							className={cn(miniButtonClass, "bg-cell text-text-primary")}
							onClick={() => setFollow(null)}
						>
							Stop
						</button>
					</span>
				) : (
					<span className="text-[12px] leading-none font-medium text-status-success-foreground">
						Live · {lines.length ? 4 : 3} editors
					</span>
				)}
			</div>
			<div className="flex-1 overflow-auto px-[26px] py-[18px] text-[15px] leading-[26px] [scrollbar-width:none]">
				<div className="mb-1.5 text-[22px] leading-[1.2] font-bold">{collaborationMock.title}</div>
				<p>
					{collaborationMock.selectionBefore}{" "}
					<span className="rounded-[3px] bg-[linear-gradient(color-mix(in_srgb,var(--accent)_22%,transparent),color-mix(in_srgb,var(--accent)_22%,transparent))] bg-[length:100%_100%] bg-left bg-no-repeat animate-home-select motion-reduce:animate-none">
						{collaborationMock.selection}
					</span>
					<Caret
						person="ana"
						name="Ana"
						dimmed={follow === "bruno" || follow === "carla"}
						focused={follow === "ana"}
					/>{" "}
					{collaborationMock.selectionAfter}
				</p>
				<div className="mt-3.5 mb-0.5 text-[16px] leading-[1.3] font-semibold">
					{collaborationMock.sectionTitle}
				</div>
				<p>
					{collaborationMock.announcement}
					<span className="ml-[0.3em] inline-block max-w-[32ch] overflow-hidden align-bottom whitespace-nowrap animate-home-typed motion-reduce:animate-none">
						{collaborationMock.typed}
					</span>
					<Caret
						person="bruno"
						name="Bruno"
						dimmed={follow === "ana" || follow === "carla"}
						focused={follow === "bruno"}
					/>
				</p>
				<p className="relative mt-3.5">
					<button
						type="button"
						aria-expanded={isCommentOpen}
						className={cn(
							"rounded-[2px] border-0 bg-[color-mix(in_srgb,var(--status-warning)_18%,transparent)] p-0 text-inherit shadow-[inset_0_-2px_0_color-mix(in_srgb,var(--status-warning)_60%,transparent)] outline-none focus-visible:shadow-focus",
							follow === "carla" &&
								"shadow-[inset_0_-2px_0_var(--color-home-green),0_0_0_3px_color-mix(in_srgb,var(--color-home-green)_20%,transparent)]",
						)}
						onClick={() => setIsCommentOpen((open) => !open)}
					>
						{collaborationMock.anchor}
					</button>{" "}
					{collaborationMock.anchorAfter}
					{isCommentOpen ? (
						<span className="absolute top-8 left-10 z-[5] flex min-w-[300px] flex-col items-stretch gap-2 rounded-xl bg-bg-elevated py-2 pr-3 pl-2.5 text-[12.5px] leading-[1.3] shadow-lift">
							<span className="flex items-center gap-2">
								<i className={cn(avatarClass, personColors.carla)}>CL</i>
								{collaborationMock.comment}
							</span>
							{replies.map((replyItem) => (
								<span key={replyItem.id} className="flex items-center gap-2">
									<i className={cn(avatarClass, "w-7", personColors.you)}>You</i>
									{replyItem.text}
								</span>
							))}
							<span className="flex items-center gap-2">
								<input
									className="min-w-0 flex-1 rounded-lg border-0 bg-cell px-2 py-1.5 text-[12.5px] leading-[1.2] text-text-primary outline-none focus-visible:shadow-focus"
									value={reply}
									onChange={(event) => setReply(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter") sendReply()
									}}
									placeholder={collaborationMock.replyPlaceholder}
									aria-label="Reply"
								/>
								<button
									type="button"
									className={cn(miniButtonClass, "bg-cell text-text-primary")}
									onClick={sendReply}
								>
									{collaborationMock.sendLabel}
								</button>
							</span>
						</span>
					) : (
						<span
							className="absolute top-8 left-10 inline-flex items-center gap-2 rounded-xl bg-bg-elevated py-2 pr-3 pl-2.5 text-[12.5px] leading-[1.3] opacity-0 shadow-lift animate-home-bubble motion-reduce:animate-none"
							aria-hidden="true"
						>
							<i className={cn(avatarClass, personColors.carla)}>CL</i>
							{collaborationMock.comment}
						</span>
					)}
				</p>
				{visibleLines.map((lineItem, index) => (
					<p key={lineItem.id} className="mt-2.5">
						{lineItem.text}
						{index === visibleLines.length - 1 ? <Caret person="you" name="You" /> : null}
					</p>
				))}
				<div className="mt-3.5">
					<input
						className="w-full rounded-lg border border-sep border-dashed bg-transparent px-2.5 py-2 text-[13px] leading-[1.3] text-text-primary outline-none placeholder:text-text-muted focus:border-home-blue"
						value={line}
						onChange={(event) => setLine(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") addLine()
						}}
						placeholder={collaborationMock.linePlaceholder}
						aria-label={collaborationMock.lineLabel}
					/>
				</div>
			</div>
			<div className="flex items-center gap-2 border-sep border-t px-3.5 py-2.5 text-[12px] leading-[1.3] text-text-muted">
				<Lock className="size-3.5 shrink-0" aria-hidden="true" />
				{collaborationMock.footer}
			</div>
		</div>
	)
}
