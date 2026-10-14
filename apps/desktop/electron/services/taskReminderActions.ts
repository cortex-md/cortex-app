import { readFile } from "node:fs/promises"
import {
	applyTaskNotificationToContent,
	resolveTaskNotificationTarget,
} from "@cortex/core/task-notification-actions"
import type { NotificationActivation } from "@cortex/platform"
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
	const target = resolveTaskNotificationTarget(activation)
	if (!target) return null
	const filePath = assertAllowedPath(target.path)
	const content = await readFile(filePath, "utf8")
	const applied = applyTaskNotificationToContent(content, target, new Date())
	if (!applied) return null
	await writeFileAtomic(filePath, applied.content, "utf8")
	return { path: target.path, content: applied.content, line: applied.line }
}
