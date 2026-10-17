import { addTaskFromQuickAdd, reportAppError, useTasksStore, useVaultStore } from "@cortex/core"
import type { QuickAddResult, Task, TaskReminder } from "@cortex/tasks"
import { type Href, router } from "expo-router"

const INBOX_WAIT_MS = 5000

export function openQuickAdd(): void {
	router.push("/quick-add" as Href)
}

function waitForInbox(timeout: number): Promise<boolean> {
	return new Promise((resolve) => {
		if (useTasksStore.getState().inboxPath) {
			resolve(true)
			return
		}
		const timer = setTimeout(() => {
			unsubscribe()
			resolve(false)
		}, timeout)
		const unsubscribe = useTasksStore.subscribe((state) => {
			if (!state.inboxPath) return
			clearTimeout(timer)
			unsubscribe()
			resolve(true)
		})
	})
}

async function ensureTaskInbox(): Promise<boolean> {
	if (useTasksStore.getState().inboxPath) return true
	const { files, vault } = useVaultStore.getState()
	if (!vault) return false
	await useTasksStore
		.getState()
		.buildIndexFromFiles(vault.path, files)
		.catch(() => undefined)
	return waitForInbox(INBOX_WAIT_MS)
}

function findAddedTask(title: string): Task | undefined {
	const { inboxPath, tasksByPath } = useTasksStore.getState()
	if (!inboxPath) return undefined
	return (tasksByPath[inboxPath] ?? [])
		.filter((task) => task.title === title)
		.reduce<Task | undefined>(
			(last, task) => (!last || task.line > last.line ? task : last),
			undefined,
		)
}

async function applyReminder(title: string, reminder: TaskReminder | null): Promise<void> {
	const task = findAddedTask(title)
	if (!task) return
	try {
		await useTasksStore.getState().updateTask(task, { reminder })
	} catch (cause) {
		await reportAppError({
			operation: "update-task",
			source: "tasks",
			cause,
			userMessage: "Cortex added the task but could not set its reminder.",
		})
	}
}

export async function submitQuickAdd(
	parsed: QuickAddResult,
	reminder?: TaskReminder | null,
): Promise<boolean> {
	if (!parsed.title) return false
	if (!(await ensureTaskInbox())) return false
	if (!(await addTaskFromQuickAdd(parsed))) return false
	if (reminder !== undefined) await applyReminder(parsed.title, reminder)
	return true
}
