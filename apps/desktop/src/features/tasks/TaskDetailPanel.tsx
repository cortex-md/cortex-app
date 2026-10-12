import { reportAppError, useTasksStore } from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import {
	addDays,
	daysBetween,
	detectReminderPreset,
	isSameRepeat,
	type ReminderPreset,
	resolveReminderPreset,
	type Task,
	type TaskPatch,
	type TaskRepeat,
} from "@cortex/tasks"
import { Button, Popover, PopoverAnchor, PopoverContent, Toggle } from "@cortex/ui"
import { FileTextIcon, InboxIcon, InfoIcon } from "lucide-react"
import { type ReactNode, useState } from "react"
import { TaskMiniCalendar } from "./TaskMiniCalendar"
import { TimeField } from "./TimeField"
import { getTaskSource, isInboxTask, openTaskInNote } from "./taskModel"

const TIME_PRESETS: readonly string[] = ["09:00", "13:00", "17:00"]

const REPEAT_OPTIONS: readonly { key: string; label: string; repeat: TaskRepeat | null }[] = [
	{ key: "none", label: "None", repeat: null },
	{ key: "day", label: "Daily", repeat: { unit: "day", interval: 1 } },
	{ key: "week", label: "Weekly", repeat: { unit: "week", interval: 1 } },
	{ key: "month", label: "Monthly", repeat: { unit: "month", interval: 1 } },
	{ key: "3days", label: "Every 3 days", repeat: { unit: "day", interval: 3 } },
]

const REMINDER_OPTIONS: readonly {
	key: ReminderPreset | "none"
	label: string
	needsTime: boolean
}[] = [
	{ key: "none", label: "None", needsTime: false },
	{ key: "at", label: "At time", needsTime: true },
	{ key: "15", label: "15 min before", needsTime: true },
	{ key: "morning", label: "Morning of", needsTime: false },
]

const RELATIVE_PRESETS = new Set<string>(["at", "5", "15", "60"])

function formatPresetTime(time: string): string {
	return time.startsWith("0") ? time.slice(1) : time
}

function TaskField({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="task-field">
			<span className="task-field-label">{label}</span>
			<div className="task-field-options">{children}</div>
		</div>
	)
}

function OptionToggle({
	pressed,
	disabled,
	onPress,
	children,
}: {
	pressed: boolean
	disabled?: boolean
	onPress: () => void
	children: ReactNode
}) {
	return (
		<Toggle
			variant="outline"
			size="sm"
			className="task-option"
			pressed={pressed}
			disabled={disabled}
			onPressedChange={() => onPress()}
		>
			{children}
		</Toggle>
	)
}

function CustomTimeToggle({
	time,
	onChange,
}: {
	time: string | undefined
	onChange: (time: string) => void
}) {
	const [open, setOpen] = useState(false)
	const [draft, setDraft] = useState<string | null>(null)
	const custom = time !== undefined && !TIME_PRESETS.includes(time)

	const handleOpenChange = (next: boolean) => {
		if (!next && draft !== null && draft !== time) onChange(draft)
		setDraft(null)
		setOpen(next)
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverAnchor asChild>
				<Toggle
					variant="outline"
					size="sm"
					className="task-option"
					pressed={custom}
					aria-haspopup="dialog"
					aria-expanded={open}
					onPressedChange={() => handleOpenChange(true)}
				>
					{custom ? time : "Other…"}
				</Toggle>
			</PopoverAnchor>
			<PopoverContent align="start" className="task-time-popover">
				<form
					onSubmit={(event) => {
						event.preventDefault()
						handleOpenChange(false)
					}}
				>
					<TimeField ariaLabel="Custom time" value={draft ?? time ?? ""} onChange={setDraft} />
				</form>
			</PopoverContent>
		</Popover>
	)
}

interface TaskDetailPanelProps {
	task: Task | undefined
	today: string
	inboxPath: string | null
}

export function TaskDetailPanel({ task, today, inboxPath }: TaskDetailPanelProps) {
	if (!task) {
		return (
			<aside className="task-detail" aria-label="Task details">
				<p className="task-empty">Select a task to set its date, repeat and reminder.</p>
			</aside>
		)
	}
	return <TaskDetailFields key={task.id} task={task} today={today} inboxPath={inboxPath} />
}

function TaskDetailFields({
	task,
	today,
	inboxPath,
}: {
	task: Task
	today: string
	inboxPath: string | null
}) {
	const untimedReminderTime = useSettingsStore((state) => state.settings.tasks.untimedReminderTime)
	const reminderPreset = detectReminderPreset(task, untimedReminderTime)
	const inbox = isInboxTask(task, inboxPath)

	const applyPatch = (patch: TaskPatch) => {
		useTasksStore
			.getState()
			.updateTask(task, patch)
			.catch((error: unknown) =>
				reportAppError({
					operation: "update-task",
					source: "tasks",
					cause: error,
					userMessage:
						"Cortex could not update this task. The note may have changed or be read-only.",
				}),
			)
	}

	const selectTime = (time: string | null) => {
		if (time === (task.time ?? null)) return
		const due = task.due ?? today
		const patch: TaskPatch = { due, time }
		if (reminderPreset && RELATIVE_PRESETS.has(reminderPreset)) {
			patch.reminder = time
				? resolveReminderPreset(reminderPreset as ReminderPreset, due, time, untimedReminderTime)
				: { time: untimedReminderTime }
		}
		applyPatch(patch)
	}

	const selectDate = (date: string) => {
		if (date === task.due) {
			applyPatch({ due: null })
			return
		}
		const patch: TaskPatch = { due: date }
		if (reminderPreset && RELATIVE_PRESETS.has(reminderPreset) && task.time) {
			patch.reminder = resolveReminderPreset(
				reminderPreset as ReminderPreset,
				date,
				task.time,
				untimedReminderTime,
			)
		} else if (task.reminder?.date && task.due) {
			patch.reminder = {
				...task.reminder,
				date: addDays(task.reminder.date, daysBetween(task.due, date)),
			}
		}
		applyPatch(patch)
	}

	const selectRepeat = (repeat: TaskRepeat | null) => {
		applyPatch(repeat ? { repeat, due: task.due ?? today } : { repeat: null })
	}

	const selectReminder = (preset: ReminderPreset | "none") => {
		if (preset === "none") {
			applyPatch({ reminder: null })
			return
		}
		const due = task.due ?? today
		applyPatch({
			due,
			reminder: resolveReminderPreset(preset, due, task.time, untimedReminderTime),
		})
	}

	return (
		<aside className="task-detail" aria-label="Task details">
			<div className="task-detail-head">
				<h3 className="task-detail-title">{task.title}</h3>
				{inbox ? (
					<span className="task-detail-source">
						<InboxIcon className="size-3.5" aria-hidden="true" />
						In Inbox
					</span>
				) : (
					<Button
						variant="link"
						className="task-detail-source"
						onClick={() => openTaskInNote(task, inboxPath)}
					>
						<FileTextIcon className="size-3.5" aria-hidden="true" />
						In {getTaskSource(task, inboxPath)}.md
					</Button>
				)}
			</div>

			<TaskMiniCalendar label="Date" selected={task.due} today={today} onSelect={selectDate} />

			<TaskField label="Time">
				<OptionToggle pressed={!task.time} onPress={() => selectTime(null)}>
					None
				</OptionToggle>
				{TIME_PRESETS.map((time) => (
					<OptionToggle key={time} pressed={task.time === time} onPress={() => selectTime(time)}>
						{formatPresetTime(time)}
					</OptionToggle>
				))}
				<CustomTimeToggle time={task.time} onChange={selectTime} />
			</TaskField>

			<TaskField label="Repeat">
				{REPEAT_OPTIONS.map((option) => (
					<OptionToggle
						key={option.key}
						pressed={isSameRepeat(option.repeat ?? undefined, task.repeat)}
						onPress={() => selectRepeat(option.repeat)}
					>
						{option.label}
					</OptionToggle>
				))}
			</TaskField>

			<TaskField label="Remind me">
				{REMINDER_OPTIONS.map((option) => (
					<OptionToggle
						key={option.key}
						pressed={
							option.key === "none" ? reminderPreset === null : reminderPreset === option.key
						}
						disabled={option.needsTime && !task.time}
						onPress={() => selectReminder(option.key)}
					>
						{option.label}
					</OptionToggle>
				))}
			</TaskField>

			<div className="task-field">
				<span className="task-field-label">In the file</span>
				<pre className="task-source-line">
					<span>{task.raw.trim()}</span>
				</pre>
			</div>

			<p className="task-hint">
				<InfoIcon className="mt-px size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
				<span>
					Tasks stay as checkboxes in your notes. Dates and repeats use the same emoji syntax as the
					Obsidian Tasks plugin, so vaults move both ways.
				</span>
			</p>
		</aside>
	)
}
