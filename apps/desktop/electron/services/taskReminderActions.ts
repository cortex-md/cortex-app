import { readFile } from "node:fs/promises"
import type { NotificationActivation } from "@cortex/platform"
import { isPathOrDescendant } from "@cortex/platform/utils"
import { applyTaskNotificationAction as applyActionToLine, locateTaskLine } from "@cortex/tasks"
import writeFileAtomic from "write-file-atomic"
import { assertAllowedPath } from "../security"

export interface AppliedTaskNotificationAction {
	path: string
	content: string
	line: number
}

export async function applyTaskNotificationAction(
	activation: NotificationActivation,
): Promise<AppliedTaskNotificationAction | null> {
	const payload = activation.payload
	if (payload?.kind !== "task" || !activation.actionId) return null
	const { path, line, raw, morningTime } = payload
	if (typeof path !== "string" || typeof line !== "number" || typeof raw !== "string") return null
	if (!path.toLowerCase().endsWith(".md") || !isPathOrDescendant(path, activation.scope)) {
		return null
	}
	const filePath = assertAllowedPath(path)
	const content = await readFile(filePath, "utf8")
	const lineBreak = content.includes("\r\n") ? "\r\n" : "\n"
	const lines = content.split(/\r?\n/)
	const index = locateTaskLine(lines, { path, line, raw })
	const current = lines[index]
	if (current === undefined) return null
	const morning = typeof morningTime === "string" ? morningTime : "09:00"
	const next = applyActionToLine(current, raw, activation.actionId, new Date(), morning)
	if (next === current) return null
	lines[index] = next
	const updated = lines.join(lineBreak)
	await writeFileAtomic(filePath, updated, "utf8")
	return { path, content: updated, line: index }
}
