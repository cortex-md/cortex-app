import { cn } from "@cortex/ui/lib/utils"
import { Bell } from "lucide-react"
import { useState } from "react"
import { tasksMock } from "../../../../content/landing"
import { parseTaskInput } from "./parseTaskInput"

interface TaskRow {
	id: number
	title: string
	meta: string
	done: boolean
	repeats?: boolean
	markdown?: string
}

export const miniToastClass =
	"absolute z-[4] inline-flex animate-home-pop items-center gap-2.5 rounded-xl bg-text-primary py-2 pr-2 pl-3 font-app text-[12.5px] leading-[1.3] font-medium whitespace-nowrap text-bg-primary shadow-lift motion-reduce:animate-none"

export const miniButtonClass =
	"rounded-lg border-0 px-2.5 py-[7px] font-app text-[12px] leading-none font-medium outline-none focus-visible:shadow-focus"

export function TasksMock() {
	const [tasks, setTasks] = useState<TaskRow[]>(() =>
		tasksMock.tasks.map((task) => ({ ...task, done: false })),
	)
	const [query, setQuery] = useState("")
	const [message, setMessage] = useState("")
	const parsed = query.trim() ? parseTaskInput(query) : null
	const addedMarkdown = tasks[1]?.markdown

	function addTask() {
		if (!parsed) return
		const [first, ...rest] = tasks
		const added: TaskRow = {
			id: Date.now(),
			title: parsed.title,
			meta: parsed.meta,
			done: false,
			markdown: parsed.markdown,
		}
		setTasks(first ? [first, added, ...rest] : [added])
		setQuery("")
		setMessage(tasksMock.addedMessage)
	}

	function toggleTask(task: TaskRow) {
		setTasks((current) =>
			current.map((item) => {
				if (item.id !== task.id) return item
				if (item.repeats && !item.done) return { ...item, meta: tasksMock.repeatedMeta }
				return { ...item, done: !item.done }
			}),
		)
		setMessage(
			task.repeats && !task.done
				? tasksMock.repeatedMessage
				: task.done
					? ""
					: `Done · ${task.title}`,
		)
	}

	return (
		<div className="absolute inset-[26px] flex flex-col gap-1.5 font-app">
			<div className="mb-2 flex items-baseline gap-2.5">
				<b className="font-sans text-[22px] leading-none font-bold">{tasksMock.title}</b>
				<span className="text-[13px] leading-none text-text-muted">
					{tasks.filter((task) => !task.done).length} left
				</span>
			</div>
			<div className="flex gap-1.5 rounded-xl bg-bg-elevated p-1 pl-3 shadow-ring focus-within:shadow-ring-strong">
				<input
					className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] leading-[30px] text-text-primary outline-none placeholder:text-text-muted"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") addTask()
					}}
					placeholder={tasksMock.placeholder}
					aria-label={tasksMock.inputLabel}
				/>
				<button
					type="button"
					className={cn(miniButtonClass, "bg-brand text-text-on-accent")}
					onClick={addTask}
				>
					{tasksMock.addLabel}
				</button>
			</div>
			{parsed ? (
				<div className="flex flex-wrap gap-1.5">
					{parsed.chips.map((chip) => (
						<span
							key={chip}
							className="rounded-full bg-brand-subtle px-[9px] py-[5px] text-[12px] leading-none font-medium text-brand-text animate-home-pop motion-reduce:animate-none"
						>
							{chip}
						</span>
					))}
				</div>
			) : null}
			{tasks.slice(0, 5).map((task, index) => {
				const isAuto = index === 0
				return (
					<div
						key={task.id}
						className="flex items-start gap-3 rounded-xl bg-bg-elevated px-3 py-[11px] text-[14.5px] leading-[1.3] shadow-ring"
					>
						<button
							type="button"
							aria-pressed={task.done}
							aria-label={`${task.done ? "Mark not done" : "Mark done"}: ${task.title}`}
							className={cn(
								"mt-px size-[18px] shrink-0 rounded-full border-0 p-0 outline-none focus-visible:shadow-focus",
								task.done ? "bg-brand" : "shadow-[inset_0_0_0_2px_var(--text-muted)]",
								isAuto && "animate-home-check motion-reduce:animate-none",
							)}
							onClick={() => {
								if (!isAuto) toggleTask(task)
							}}
						/>
						<span
							className={cn(
								task.done && "line-through opacity-45",
								isAuto && "animate-home-strike motion-reduce:animate-none",
							)}
						>
							{task.title}
							<small className="mt-[3px] block text-[12px] leading-[1.2] text-text-muted">
								{task.meta}
							</small>
						</span>
					</div>
				)
			})}
			<div className="mt-2 rounded-[10px] bg-cell px-3 py-[9px] font-mono text-[12px] leading-[1.4] text-text-secondary">
				{parsed ? parsed.markdown : (addedMarkdown ?? tasksMock.defaultLine)}
			</div>
			<div
				className="absolute -top-2 -right-1.5 flex w-[290px] items-center gap-2.5 rounded-2xl bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] px-3.5 py-3 text-[12.5px] leading-[1.35] opacity-0 shadow-lift backdrop-blur-md animate-home-notif motion-reduce:animate-none"
				aria-hidden="true"
			>
				<Bell className="size-4 shrink-0" />
				<span>
					<b className="block font-semibold">{tasksMock.notification.title}</b>
					{tasksMock.notification.meta}
				</span>
				<em className="ml-auto rounded-lg bg-cell px-[9px] py-[5px] text-[12px] leading-none font-medium not-italic">
					{tasksMock.notification.action}
				</em>
			</div>
			{message ? (
				<div className={cn(miniToastClass, "-bottom-1 left-0")} aria-live="polite">
					{message}
				</div>
			) : null}
		</div>
	)
}
