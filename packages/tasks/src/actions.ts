import {
	addDays,
	clockTimeToMinutes,
	combineDateTime,
	daysBetween,
	shiftDateTime,
	toClockTime,
	toIsoDate,
} from "./dates"
import { applyTaskPatch, parseTaskLine } from "./parse"
import { nextOccurrence, nextOccurrenceAfter } from "./recurrence"
import type { ClockTime, IsoDate, ReminderPreset, TaskFields, TaskReminder } from "./types"

export interface TaskCompletionResult {
	line: string
	nextDue?: IsoDate
}

export function toggleTaskLine(line: string, today: IsoDate): TaskCompletionResult {
	const fields = parseTaskLine(line)
	if (!fields) return { line }
	if (fields.status === "done") {
		return { line: applyTaskPatch(line, { status: "open", doneDate: null }) }
	}
	if (fields.repeat && (fields.due || fields.repeat.whenDone)) {
		const nextDue = fields.repeat.whenDone
			? nextOccurrence(today, fields.repeat)
			: nextOccurrenceAfter(fields.due ?? today, fields.repeat, today)
		const shift = daysBetween(fields.due ?? today, nextDue)
		const reminder = fields.reminder?.date
			? { ...fields.reminder, date: addDays(fields.reminder.date, shift) }
			: undefined
		return {
			line: applyTaskPatch(line, reminder ? { due: nextDue, reminder } : { due: nextDue }),
			nextDue,
		}
	}
	return { line: applyTaskPatch(line, { status: "done", doneDate: today }) }
}

export function snoozeTaskLine(line: string, until: Date): string {
	return applyTaskPatch(line, { reminder: { date: toIsoDate(until), time: toClockTime(until) } })
}

export function resolveReminderPreset(
	preset: ReminderPreset,
	due: IsoDate,
	time: ClockTime | undefined,
	untimedReminderTime: ClockTime,
): TaskReminder {
	if (preset === "morning" || !time) return { time: untimedReminderTime }
	if (preset === "at") return { time }
	const shifted = shiftDateTime(due, time, -Number(preset))
	return shifted.date === due ? { time: shifted.time } : shifted
}

export function detectReminderPreset(
	fields: Pick<TaskFields, "due" | "time" | "reminder">,
	untimedReminderTime: ClockTime,
): ReminderPreset | "custom" | null {
	const { due, time, reminder } = fields
	if (!reminder) return null
	if (!due) return "custom"
	if (!time) return !reminder.date && reminder.time === untimedReminderTime ? "morning" : "custom"
	const dueAt = combineDateTime(due, time).getTime()
	const reminderAt = combineDateTime(reminder.date ?? due, reminder.time).getTime()
	const offsetMinutes = Math.round((dueAt - reminderAt) / 60_000)
	if (offsetMinutes === 0) return "at"
	if (offsetMinutes === 5 || offsetMinutes === 15 || offsetMinutes === 60) {
		return String(offsetMinutes) as ReminderPreset
	}
	if (!reminder.date && reminder.time === untimedReminderTime) return "morning"
	return "custom"
}

export type SnoozeOption = "10m" | "1h" | "tomorrow"

export const TASK_NOTIFICATION_ACTIONS = [
	{ id: "done", label: "Mark done", snooze: null },
	{ id: "snooze-10m", label: "Snooze 10 minutes", snooze: "10m" },
	{ id: "snooze-1h", label: "Snooze 1 hour", snooze: "1h" },
	{ id: "snooze-tomorrow", label: "Tomorrow morning", snooze: "tomorrow" },
] as const satisfies readonly { id: string; label: string; snooze: SnoozeOption | null }[]

export function applyTaskNotificationAction(
	line: string,
	notifiedRaw: string,
	actionId: string,
	now: Date,
	morningTime: ClockTime,
): string {
	const action = TASK_NOTIFICATION_ACTIONS.find((candidate) => candidate.id === actionId)
	const current = parseTaskLine(line)
	const notified = parseTaskLine(notifiedRaw)
	if (!action || current?.status !== "open" || current.due !== notified?.due) return line
	if (!action.snooze) return toggleTaskLine(line, toIsoDate(now)).line
	return snoozeTaskLine(line, snoozeTarget(action.snooze, now, morningTime))
}

export function snoozeTarget(option: SnoozeOption, now: Date, morningTime: ClockTime): Date {
	const target = new Date(now)
	target.setSeconds(0, 0)
	if (option === "10m") target.setMinutes(target.getMinutes() + 10)
	else if (option === "1h") target.setHours(target.getHours() + 1)
	else {
		const minutes = clockTimeToMinutes(morningTime)
		target.setHours(Math.floor(minutes / 60), minutes % 60)
		target.setDate(target.getDate() + 1)
	}
	return target
}
