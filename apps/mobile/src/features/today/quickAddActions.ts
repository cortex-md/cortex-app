import { addTaskFromQuickAdd, useTasksStore, useVaultStore } from "@cortex/core"
import type { QuickAddResult } from "@cortex/tasks"
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

export async function submitQuickAdd(parsed: QuickAddResult): Promise<boolean> {
	if (!parsed.title) return false
	if (!(await ensureTaskInbox())) return false
	return addTaskFromQuickAdd(parsed)
}
