import {
	getPlatform,
	type NotificationActivation,
	type ScheduledNotificationRequest,
} from "@cortex/platform"
import { VAULT_FILES } from "@cortex/platform/utils"
import { useSettingsStore } from "@cortex/settings"
import {
	applyTaskNotificationAction,
	planReminders,
	type ScheduledReminder,
	TASK_NOTIFICATION_ACTIONS,
	type Task,
	type TaskRef,
} from "@cortex/tasks"
import { openNoteAtLine } from "../notes/wikiLinks"
import { selectAllTasks, useTasksStore } from "../stores/tasksStore"
import { useVaultStore } from "../stores/vaultStore"

const SYNC_APPLIED_STATUSES = new Set(["synced", "merged", "deleted"])
const RESCHEDULE_DELAY_MS = 500
const REPLAN_INTERVAL_MS = 30 * 60 * 1000

function toNotificationRequest(
	reminder: ScheduledReminder,
	silent: boolean,
	morningTime: string,
): ScheduledNotificationRequest {
	const request: ScheduledNotificationRequest = {
		id: reminder.id,
		fireAt: reminder.fireAt,
		title: reminder.title,
		body: reminder.body,
		silent,
	}
	if (reminder.task) {
		request.actions = TASK_NOTIFICATION_ACTIONS.map(({ id, label }) => ({ id, label }))
		request.payload = {
			kind: "task",
			path: reminder.task.path,
			line: reminder.task.line,
			raw: reminder.task.raw,
			morningTime,
		}
	}
	return request
}

function readTaskRef(activation: NotificationActivation): TaskRef | null {
	const payload = activation.payload
	if (payload?.kind !== "task") return null
	const { path, line, raw } = payload
	if (typeof path !== "string" || typeof line !== "number" || typeof raw !== "string") return null
	return { path, line, raw }
}

function findIndexedTask(ref: TaskRef): Task | undefined {
	const tasks = useTasksStore.getState().tasksByPath[ref.path] ?? []
	return tasks.find((task) => task.raw === ref.raw) ?? tasks.find((task) => task.line === ref.line)
}

export function planVaultReminders(now = new Date()): ScheduledNotificationRequest[] {
	const tasksState = useTasksStore.getState()
	const settings = useSettingsStore.getState().settings.tasks
	return planReminders(
		selectAllTasks(tasksState),
		{
			remindersEnabled: settings.remindersEnabled,
			digestEnabled: settings.digestEnabled,
			digestTime: settings.digestTime,
			quietHours: {
				enabled: settings.quietHoursEnabled,
				start: settings.quietHoursStart,
				end: settings.quietHoursEnd,
			},
			inboxPath: tasksState.inboxPath ?? undefined,
		},
		now,
	).map((reminder) =>
		toNotificationRequest(reminder, !settings.sound, settings.untimedReminderTime),
	)
}

async function handleTaskActivation(activation: NotificationActivation): Promise<void> {
	const vault = useVaultStore.getState().vault
	const task = readTaskRef(activation)
	if (!vault || activation.scope !== vault.path) return
	if (activation.actionId === null) {
		const indexedTask = task ? findIndexedTask(task) : undefined
		if (indexedTask && indexedTask.path !== useTasksStore.getState().inboxPath) {
			openNoteAtLine(indexedTask.path, indexedTask.bodyLine)
		}
		return
	}
	if (!task) return
	const { actionId } = activation
	const morningTime = useSettingsStore.getState().settings.tasks.untimedReminderTime
	await useTasksStore
		.getState()
		.transformTask(task, (line) =>
			applyTaskNotificationAction(line, task.raw, actionId, new Date(), morningTime),
		)
}

export function startTasksRuntime(): () => void {
	const notifications = getPlatform().notifications
	if (!notifications.schedule) return () => {}
	let rescheduleTimer: ReturnType<typeof setTimeout> | null = null

	const reschedule = () => {
		rescheduleTimer = null
		const vault = useVaultStore.getState().vault
		const { inboxPath } = useTasksStore.getState()
		if (!vault || !inboxPath) return
		notifications
			.schedule?.(vault.path, planVaultReminders())
			.catch((error) => console.warn("[tasks] failed to schedule reminders:", error))
	}

	const scheduleReschedule = () => {
		if (rescheduleTimer) clearTimeout(rescheduleTimer)
		rescheduleTimer = setTimeout(reschedule, RESCHEDULE_DELAY_MS)
	}

	const pendingActivations: NotificationActivation[] = []
	const runActivation = (activation: NotificationActivation) => {
		handleTaskActivation(activation).catch((error) =>
			console.warn("[tasks] failed to handle notification action:", error),
		)
	}
	const flushActivations = () => {
		if (!useVaultStore.getState().vault || !useTasksStore.getState().inboxPath) return
		for (const activation of pendingActivations.splice(0)) runActivation(activation)
	}

	const unsubscribeTasks = useTasksStore.subscribe((state, previousState) => {
		if (state.tasksByPath !== previousState.tasksByPath) scheduleReschedule()
		if (state.inboxPath && state.inboxPath !== previousState.inboxPath) flushActivations()
	})
	const unsubscribeSettings = useSettingsStore.subscribe((state, previousState) => {
		if (state.settings.tasks !== previousState.settings.tasks) scheduleReschedule()
	})
	const unsubscribeActivation = notifications.onActivation?.((activation) => {
		pendingActivations.push(activation)
		flushActivations()
	})
	const unsubscribeSyncEvents = getPlatform().sync?.onFileEvent?.((event) => {
		const changedPath = event.path.replaceAll("\\", "/")
		if (changedPath.endsWith(VAULT_FILES.taskInbox) && SYNC_APPLIED_STATUSES.has(event.status)) {
			void useTasksStore.getState().reloadInbox()
		}
	})
	const replanInterval = setInterval(scheduleReschedule, REPLAN_INTERVAL_MS)

	return () => {
		if (rescheduleTimer) clearTimeout(rescheduleTimer)
		clearInterval(replanInterval)
		unsubscribeTasks()
		unsubscribeSettings()
		unsubscribeActivation?.()
		unsubscribeSyncEvents?.()
	}
}
