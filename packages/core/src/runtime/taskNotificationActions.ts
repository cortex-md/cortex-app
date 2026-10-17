import type { NotificationActivation } from "@cortex/platform"
import { isPathOrDescendant } from "@cortex/platform/utils"
import { applyTaskNotificationAction as applyActionToLine, locateTaskLine } from "@cortex/tasks"

export interface TaskNotificationTarget {
	path: string
	line: number
	raw: string
	morningTime: unknown
	actionId: string
}

export function resolveTaskNotificationTarget(
	activation: NotificationActivation,
): TaskNotificationTarget | null {
	const payload = activation.payload
	if (payload?.kind !== "task" || !activation.actionId) return null
	const { path, line, raw, morningTime } = payload
	if (typeof path !== "string" || typeof line !== "number" || typeof raw !== "string") return null
	if (!path.toLowerCase().endsWith(".md") || !isPathOrDescendant(path, activation.scope)) {
		return null
	}
	return { path, line, raw, morningTime, actionId: activation.actionId }
}

export function applyTaskNotificationToContent(
	content: string,
	{ path, line, raw, morningTime, actionId }: TaskNotificationTarget,
	now: Date,
): { content: string; line: number } | null {
	const lineBreak = content.includes("\r\n") ? "\r\n" : "\n"
	const lines = content.split(/\r?\n/)
	const index = locateTaskLine(lines, { path, line, raw })
	const current = lines[index]
	if (current === undefined) return null
	const morning = typeof morningTime === "string" ? morningTime : "09:00"
	const next = applyActionToLine(current, raw, actionId, now, morning)
	if (next === current) return null
	lines[index] = next
	const updated = lines.join(lineBreak)
	return { content: updated, line: index }
}
