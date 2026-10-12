import { groupTasks } from "./buckets"
import { addDays, clockTimeToMinutes, combineDateTime, toIsoDate } from "./dates"
import type { QuietHours, ReminderPlanOptions, ScheduledReminder, Task } from "./types"

const DEFAULT_HORIZON_MS = 48 * 60 * 60 * 1000
const MISSED_TOLERANCE_MS = 6 * 60 * 60 * 1000
const DIGEST_LOOKAHEAD_DAYS = 2

export function taskSourceName(path: string, inboxPath?: string): string {
	if (inboxPath && path === inboxPath) return "Inbox"
	const fileName = path.split(/[\\/]/).at(-1) ?? path
	return fileName.replace(/\.md$/i, "")
}

export function taskReminderAt(task: Task): Date | null {
	const date = task.reminder?.date ?? task.due
	if (!task.reminder || !date) return null
	return combineDateTime(date, task.reminder.time)
}

function isWithinQuietHours(minutes: number, quietHours: QuietHours): boolean {
	const start = clockTimeToMinutes(quietHours.start)
	const end = clockTimeToMinutes(quietHours.end)
	if (start === end) return false
	return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

export function deferForQuietHours(fireAt: Date, quietHours: QuietHours): Date {
	if (!quietHours.enabled) return fireAt
	const minutes = fireAt.getHours() * 60 + fireAt.getMinutes()
	if (!isWithinQuietHours(minutes, quietHours)) return fireAt
	const endMinutes = clockTimeToMinutes(quietHours.end)
	const deferred = new Date(fireAt)
	deferred.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0)
	if (deferred <= fireAt) deferred.setDate(deferred.getDate() + 1)
	return deferred
}

function describeTaskBody(task: Task, inboxPath?: string): string {
	const source = taskSourceName(task.path, inboxPath)
	return task.time ? `Due ${task.time} · ${source}` : source
}

export function buildDigestText(tasks: Iterable<Task>, day: string): string | null {
	const groups = groupTasks(tasks, day)
	const dueCount = groups.today.length
	const overdueCount = groups.overdue.length
	if (dueCount === 0 && overdueCount === 0) return null
	const parts = [`${dueCount} ${dueCount === 1 ? "task" : "tasks"} today`]
	if (overdueCount > 0) parts.push(`${overdueCount} overdue`)
	const firstTimed = groups.today.find((task) => task.time)
	const summary = `${parts.join(", ")}.`
	return firstTimed ? `${summary} First up: ${firstTimed.title} at ${firstTimed.time}.` : summary
}

export function createTaskReminder(
	task: Task,
	reminderAt: Date,
	fireAt: number,
	inboxPath?: string,
): ScheduledReminder {
	return {
		id: `task:${task.id}:${reminderAt.getTime()}`,
		kind: "task",
		fireAt,
		title: task.title,
		body: describeTaskBody(task, inboxPath),
		task: { path: task.path, line: task.line, raw: task.raw },
	}
}

export function planReminders(
	tasks: readonly Task[],
	options: ReminderPlanOptions,
	now: Date,
): ScheduledReminder[] {
	const horizonEnd = now.getTime() + (options.horizonMs ?? DEFAULT_HORIZON_MS)
	const earliest = now.getTime() - MISSED_TOLERANCE_MS
	const reminders: ScheduledReminder[] = []

	if (options.remindersEnabled) {
		for (const task of tasks) {
			if (task.status === "done") continue
			const reminderAt = taskReminderAt(task)
			if (!reminderAt) continue
			const fireAt = deferForQuietHours(reminderAt, options.quietHours).getTime()
			if (fireAt < earliest || fireAt > horizonEnd) continue
			reminders.push(createTaskReminder(task, reminderAt, fireAt, options.inboxPath))
		}
	}

	if (options.digestEnabled) {
		const today = toIsoDate(now)
		for (let offset = 0; offset <= DIGEST_LOOKAHEAD_DAYS; offset++) {
			const day = addDays(today, offset)
			const fireAt = deferForQuietHours(
				combineDateTime(day, options.digestTime),
				options.quietHours,
			).getTime()
			if (fireAt < earliest || fireAt > horizonEnd) continue
			const body = buildDigestText(tasks, day)
			if (!body) continue
			reminders.push({
				id: `digest:${day}`,
				kind: "digest",
				fireAt,
				title: "Today in Cortex",
				body,
			})
		}
	}

	return reminders.sort((left, right) => left.fireAt - right.fireAt)
}
