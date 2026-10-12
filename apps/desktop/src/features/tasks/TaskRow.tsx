import { useSettingsStore } from "@cortex/settings"
import { describeRepeat, formatRelativeDay, type Task } from "@cortex/tasks"
import { Button, Checkbox } from "@cortex/ui"
import { BellIcon, CalendarIcon, FileTextIcon, InboxIcon, RepeatIcon } from "lucide-react"
import { type MouseEvent, memo } from "react"
import {
	describeSidebarTaskTime,
	describeTaskReminder,
	getTaskSource,
	isInboxTask,
	type TaskSurface,
	toggleTaskFrom,
} from "./taskModel"

interface TaskRowProps {
	task: Task
	today: string
	inboxPath: string | null
	surface: TaskSurface
	showDate?: boolean
	selected?: boolean
	onOpen: (task: Task) => void
}

function TaskCheck({
	task,
	surface,
	inboxPath,
}: Pick<TaskRowProps, "task" | "surface" | "inboxPath">) {
	const done = task.status === "done"
	return (
		<Checkbox
			className="task-check"
			checked={done}
			aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
			onClick={(event: MouseEvent) => event.stopPropagation()}
			onCheckedChange={() => void toggleTaskFrom(surface, task, inboxPath)}
		/>
	)
}

function TaskPageMeta({
	task,
	today,
	inboxPath,
	showDate,
}: Omit<TaskRowProps, "surface" | "onOpen">) {
	const untimedReminderTime = useSettingsStore((state) => state.settings.tasks.untimedReminderTime)
	const overdue = task.status === "open" && task.due !== undefined && task.due < today
	const SourceIcon = isInboxTask(task, inboxPath) ? InboxIcon : FileTextIcon
	return (
		<span className="task-row-meta">
			{showDate && task.due && (
				<span data-overdue={overdue ? "true" : undefined}>
					<CalendarIcon className="size-3" aria-hidden="true" />
					{formatRelativeDay(task.due, today)}
				</span>
			)}
			{task.repeat && (
				<span>
					<RepeatIcon className="size-3" aria-hidden="true" />
					{describeRepeat(task.repeat)}
				</span>
			)}
			{task.reminder && (
				<span>
					<BellIcon className="size-3" aria-hidden="true" />
					{describeTaskReminder(task, untimedReminderTime, today)}
				</span>
			)}
			<span className="task-row-source">
				<SourceIcon className="size-3" aria-hidden="true" />
				{getTaskSource(task, inboxPath)}
			</span>
		</span>
	)
}

export const TaskRow = memo(function TaskRow({
	task,
	today,
	inboxPath,
	surface,
	showDate = false,
	selected = false,
	onOpen,
}: TaskRowProps) {
	const done = task.status === "done"
	const overdue = !done && task.due !== undefined && task.due < today
	const trailing = surface === "sidebar" ? describeSidebarTaskTime(task, today) : (task.time ?? "")

	return (
		<div
			className="task-row"
			data-surface={surface}
			data-done={done ? "true" : undefined}
			data-selected={selected ? "true" : undefined}
		>
			<TaskCheck task={task} surface={surface} inboxPath={inboxPath} />
			<Button variant="ghost" className="task-row-open" onClick={() => onOpen(task)}>
				<span className="task-row-title">{task.title}</span>
				{surface === "sidebar" ? (
					<span className="task-row-source">{getTaskSource(task, inboxPath)}</span>
				) : (
					<TaskPageMeta task={task} today={today} inboxPath={inboxPath} showDate={showDate} />
				)}
			</Button>
			{trailing && (
				<span className="task-row-trailing" data-overdue={overdue ? "true" : undefined}>
					{trailing}
				</span>
			)}
		</div>
	)
})
