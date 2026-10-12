import { readFile } from "node:fs/promises"
import type {
	NativeNotificationPermissionState,
	NotificationActivation,
	ScheduledNotificationRequest,
} from "@cortex/platform"
import { getVaultFilePath, VAULT_FILES } from "@cortex/platform/utils"
import { createTaskReminder, parseTasks, taskReminderAt } from "@cortex/tasks"
import { app, Notification, powerMonitor } from "electron"
import writeFileAtomic from "write-file-atomic"
import { userDataPath } from "../paths"
import { emitToVaultWindow, openVaultWindow } from "../windows"
import {
	type AppliedTaskNotificationAction,
	applyTaskNotificationAction,
} from "./taskReminderActions"

const MAX_TIMER_DELAY_MS = 60 * 60 * 1000
const STALE_REMINDER_MS = 6 * 60 * 60 * 1000
const FIRED_RETENTION_MS = 3 * 24 * 60 * 60 * 1000
const MAX_SCHEDULED_PER_SCOPE = 500
const PERSIST_DELAY_MS = 250
const LATE_SCHEDULE_TOLERANCE_MS = 60 * 1000

interface FiredReminder {
	scope: string
	fireAt: number
}

interface PersistedReminders {
	schedules: Record<string, ScheduledNotificationRequest[]>
	fired: Record<string, FiredReminder>
}

const schedules = new Map<string, ScheduledNotificationRequest[]>()
const fired = new Map<string, FiredReminder>()
const visibleNotifications = new Map<string, Notification>()
let timer: NodeJS.Timeout | null = null
let persistTimer: NodeJS.Timeout | null = null
let deliveryFailed = false
let started = false

const remindersPath = () => userDataPath("reminders.json")

function isValidRequest(value: unknown): value is ScheduledNotificationRequest {
	if (!value || typeof value !== "object") return false
	const request = value as Partial<ScheduledNotificationRequest>
	return (
		typeof request.id === "string" &&
		request.id.length > 0 &&
		typeof request.title === "string" &&
		typeof request.fireAt === "number" &&
		Number.isFinite(request.fireAt)
	)
}

function persistSoon(): void {
	if (persistTimer) clearTimeout(persistTimer)
	persistTimer = setTimeout(() => {
		persistTimer = null
		const snapshot: PersistedReminders = {
			schedules: Object.fromEntries(schedules),
			fired: Object.fromEntries(fired),
		}
		writeFileAtomic(remindersPath(), JSON.stringify(snapshot), "utf8").catch((error) =>
			console.warn("[reminders] failed to persist schedule:", error),
		)
	}, PERSIST_DELAY_MS)
}

async function loadPersistedReminders(): Promise<void> {
	try {
		const parsed = JSON.parse(
			await readFile(remindersPath(), "utf8"),
		) as Partial<PersistedReminders>
		for (const [scope, requests] of Object.entries(parsed.schedules ?? {})) {
			if (Array.isArray(requests)) schedules.set(scope, requests.filter(isValidRequest))
		}
		for (const [id, entry] of Object.entries(parsed.fired ?? {})) {
			if (entry && typeof entry.fireAt === "number") fired.set(id, entry)
		}
	} catch {}
}

function pruneFired(now: number): void {
	for (const [id, entry] of fired) {
		if (entry.fireAt < now - FIRED_RETENTION_MS) fired.delete(id)
	}
}

function handleActivation(activation: NotificationActivation): void {
	if (activation.actionId === null) openVaultWindow(activation.scope)
	if (emitToVaultWindow(activation.scope, "notification-activation", activation)) return
	if (activation.actionId !== null) {
		applyTaskNotificationAction(activation)
			.then((applied) => {
				if (applied) scheduleFollowUpReminder(activation, applied)
			})
			.catch((error) => console.warn("[reminders] failed to apply notification action:", error))
	}
}

function scheduleFollowUpReminder(
	activation: NotificationActivation,
	applied: AppliedTaskNotificationAction,
): void {
	const scheduled = schedules.get(activation.scope) ?? []
	const source = scheduled.find((request) => request.id === activation.notificationId)
	const task = parseTasks(applied.path, applied.content).find((item) => item.line === applied.line)
	const reminderAt = task?.status === "open" ? taskReminderAt(task) : null
	if (!source || !task || !reminderAt || reminderAt.getTime() <= Date.now()) return
	const inboxPath = getVaultFilePath(activation.scope, VAULT_FILES.taskInbox)
	const reminder = createTaskReminder(task, reminderAt, reminderAt.getTime(), inboxPath)
	const request: ScheduledNotificationRequest = {
		...source,
		id: reminder.id,
		fireAt: reminder.fireAt,
		title: reminder.title,
		body: reminder.body,
		payload: { ...source.payload, line: task.line, raw: task.raw },
	}
	schedules.set(activation.scope, [
		...scheduled.filter((candidate) => candidate.id !== request.id),
		request,
	])
	persistSoon()
	armTimer()
}

function showReminder(scope: string, request: ScheduledNotificationRequest): void {
	const actions = request.actions ?? []
	const notification = new Notification({
		id: request.id,
		title: request.title,
		body: request.body,
		silent: request.silent ?? false,
		actions: actions.map((action) => ({ type: "button" as const, text: action.label })),
	})
	const activation = (actionId: string | null): NotificationActivation => ({
		scope,
		notificationId: request.id,
		actionId,
		payload: request.payload,
	})
	notification.on("click", () => handleActivation(activation(null)))
	notification.on("action", (details) => {
		const action = actions[details.actionIndex]
		if (action) handleActivation(activation(action.id))
	})
	notification.on("failed", () => {
		deliveryFailed = true
	})
	notification.on("close", () => visibleNotifications.delete(request.id))
	visibleNotifications.set(request.id, notification)
	notification.show()
}

function fireDueReminders(): void {
	const now = Date.now()
	for (const [scope, requests] of schedules) {
		for (const request of requests) {
			if (request.fireAt > now + 500 || fired.has(request.id)) continue
			fired.set(request.id, { scope, fireAt: request.fireAt })
			if (now - request.fireAt <= STALE_REMINDER_MS && Notification.isSupported()) {
				showReminder(scope, request)
			}
		}
	}
	pruneFired(now)
	persistSoon()
	armTimer()
}

function armTimer(): void {
	if (timer) clearTimeout(timer)
	timer = null
	let nextFireAt = Number.POSITIVE_INFINITY
	for (const requests of schedules.values()) {
		for (const request of requests) {
			if (!fired.has(request.id) && request.fireAt < nextFireAt) nextFireAt = request.fireAt
		}
	}
	if (!Number.isFinite(nextFireAt)) return
	const delay = Math.min(Math.max(nextFireAt - Date.now(), 0), MAX_TIMER_DELAY_MS)
	timer = setTimeout(fireDueReminders, delay)
}

function removeDeliveredOutsidePlan(scope: string, plannedIds: ReadonlySet<string>): void {
	const removed: string[] = []
	for (const [id, entry] of fired) {
		if (entry.scope !== scope || plannedIds.has(id)) continue
		removed.push(id)
		visibleNotifications.get(id)?.close()
		visibleNotifications.delete(id)
	}
	if (removed.length > 0 && process.platform === "darwin") Notification.remove(removed)
}

export function scheduleReminders(scope: string, requests: ScheduledNotificationRequest[]): void {
	const valid = (Array.isArray(requests) ? requests : [])
		.filter(isValidRequest)
		.slice(0, MAX_SCHEDULED_PER_SCOPE)
	removeDeliveredOutsidePlan(scope, new Set(valid.map((request) => request.id)))
	const known = new Set((schedules.get(scope) ?? []).map((request) => request.id))
	const lateBefore = Date.now() - LATE_SCHEDULE_TOLERANCE_MS
	for (const request of valid) {
		if (request.fireAt < lateBefore && !known.has(request.id) && !fired.has(request.id)) {
			fired.set(request.id, { scope, fireAt: request.fireAt })
		}
	}
	if (valid.length === 0) schedules.delete(scope)
	else schedules.set(scope, valid)
	persistSoon()
	if (started) fireDueReminders()
}

export function reminderPermission(): NativeNotificationPermissionState {
	if (!Notification.isSupported()) return "unsupported"
	return deliveryFailed ? "denied" : "granted"
}

export function markNotificationDeliveryFailed(): void {
	deliveryFailed = true
}

export function markNotificationDelivered(): void {
	deliveryFailed = false
}

export async function startReminderScheduler(): Promise<void> {
	if (process.platform === "win32") app.setAppUserModelId("app.cortex.desktop")
	await loadPersistedReminders()
	started = true
	powerMonitor.on("resume", armTimer)
	powerMonitor.on("unlock-screen", armTimer)
	fireDueReminders()
}
