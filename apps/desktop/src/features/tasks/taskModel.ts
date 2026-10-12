import {
	openNoteAtLine,
	reportAppError,
	selectAllTasks,
	type TaskLineEdit,
	useTasksStore,
	useUIStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import {
	detectReminderPreset,
	formatRelativeDay,
	formatShortDay,
	groupTasks,
	type QuickAddResult,
	resolveReminderPreset,
	type Task,
	type TaskGroups,
	type TaskRef,
	taskSourceName,
	toIsoDate,
} from "@cortex/tasks"
import { useMemo } from "react"
import { useLocalToday } from "@/hooks/useMinuteNow"
import { createModalStore } from "@/utils/createModalStore"

export const TODAY_VIEW_ID = "tasks-today"
export const TASKS_SIDEBAR_VIEW_ID = "tasks"

export type TodayTab = "today" | "upcoming" | "inbox"

export interface TodayViewState {
	tab: TodayTab
	selectedTaskId: string | null
}

export type TaskSurface = "sidebar" | "today"

export interface TaskUndoTarget {
	surface: TaskSurface
	message: string
	edit: TaskLineEdit
}

export const taskUndoToast = createModalStore<TaskUndoTarget>()
export const taskQuickAddFocus = createModalStore<number>()

const TODAY_TABS: readonly TodayTab[] = ["today", "upcoming", "inbox"]

export function readTodayViewState(viewState: Record<string, unknown>): TodayViewState {
	const tab = TODAY_TABS.find((candidate) => candidate === viewState.tab) ?? "today"
	return {
		tab,
		selectedTaskId: typeof viewState.selectedTaskId === "string" ? viewState.selectedTaskId : null,
	}
}

export function openTodayView(tab: TodayTab = "today"): void {
	if (!useVaultStore.getState().vault) return
	const workspace = useWorkspaceStore.getState()
	for (const [paneId, pane] of Object.entries(workspace.panes)) {
		const existing = pane.tabs.find((tab) => tab.tabType === "view" && tab.viewId === TODAY_VIEW_ID)
		if (existing) {
			workspace.activateTab(existing.id, paneId)
			if (readTodayViewState(existing.viewState ?? {}).tab !== tab) {
				workspace.updateViewTab(existing.id, paneId, {
					viewState: { ...existing.viewState, tab, selectedTaskId: null },
				})
			}
			return
		}
	}
	workspace.openViewTab(TODAY_VIEW_ID, "Today", { viewState: { tab, selectedTaskId: null } })
}

export function openTasksSidebar(focusQuickAdd = false): void {
	const ui = useUIStore.getState()
	if (ui.leftSidebarCollapsed) ui.toggleLeftSidebar()
	ui.setLeftSidebarView(TASKS_SIDEBAR_VIEW_ID)
	if (focusQuickAdd) taskQuickAddFocus.open(Date.now())
}

export function useTodayIsoDate(): string {
	return useLocalToday()
}

export function useTaskGroups(): { groups: TaskGroups; today: string; inboxPath: string | null } {
	const tasks = useTasksStore(selectAllTasks)
	const inboxPath = useTasksStore((state) => state.inboxPath)
	const today = useTodayIsoDate()
	const groups = useMemo(() => groupTasks(tasks, today), [tasks, today])
	return { groups, today, inboxPath }
}

export function getTaskSource(task: Task, inboxPath: string | null): string {
	return taskSourceName(task.path, inboxPath ?? undefined)
}

const REMINDER_PRESET_LABELS: Record<string, string> = {
	at: "At time",
	"5": "5 min before",
	"15": "15 min before",
	"60": "1 hour before",
}

export function describeTaskReminder(
	task: Task,
	untimedReminderTime: string,
	today: string,
): string {
	if (!task.reminder) return ""
	const preset = detectReminderPreset(task, untimedReminderTime)
	if (preset === "morning") return `Morning of, ${task.reminder.time}`
	if (preset && preset !== "custom") return REMINDER_PRESET_LABELS[preset] ?? task.reminder.time
	if (task.reminder.date && task.reminder.date !== task.due) {
		return `${formatRelativeDay(task.reminder.date, today)} ${task.reminder.time}`
	}
	return task.reminder.time
}

export function describeSidebarTaskTime(task: Task, today: string): string {
	if (task.status === "open" && task.due && task.due < today) return formatShortDay(task.due)
	return task.time ?? ""
}

export function isInboxTask(task: Task, inboxPath: string | null): boolean {
	return inboxPath !== null && task.path === inboxPath
}

export function openTaskInNote(task: Task, inboxPath: string | null): void {
	if (isInboxTask(task, inboxPath)) return
	openNoteAtLine(task.path, task.bodyLine)
}

function reportTaskError(operation: string, error: unknown): void {
	void reportAppError({
		operation,
		source: "tasks",
		cause: error,
		userMessage: "Cortex could not update this task. The note may have changed or be read-only.",
	})
}

export async function toggleTaskFrom(
	surface: TaskSurface,
	task: Task,
	inboxPath: string | null,
): Promise<void> {
	try {
		const edit = await useTasksStore.getState().toggleTask(task)
		if (!edit || task.status === "done") return
		const today = toIsoDate(new Date())
		const message = edit.nextDue
			? `“${task.title}” done · next ${formatRelativeDay(edit.nextDue, today)}`
			: `Checked off in ${getTaskSource(task, inboxPath)}`
		taskUndoToast.open({ surface, message, edit })
	} catch (error) {
		reportTaskError("toggle-task", error)
	}
}

export async function toggleTaskInNote(ref: TaskRef): Promise<void> {
	try {
		await useTasksStore.getState().toggleTask(ref)
	} catch (error) {
		reportTaskError("toggle-task", error)
	}
}

export async function undoTaskEdit(target: TaskUndoTarget): Promise<void> {
	taskUndoToast.close()
	try {
		await useTasksStore.getState().revertTaskEdit(target.edit)
	} catch (error) {
		reportTaskError("undo-task-edit", error)
	}
}

export async function addTaskFromQuickAdd(parsed: QuickAddResult): Promise<boolean> {
	if (!parsed.title) return false
	const settings = useSettingsStore.getState().settings.tasks
	const reminder =
		parsed.due && parsed.time
			? resolveReminderPreset(
					settings.defaultReminder,
					parsed.due,
					parsed.time,
					settings.untimedReminderTime,
				)
			: undefined
	try {
		const edit = await useTasksStore.getState().addTask({
			status: "open",
			title: parsed.title,
			due: parsed.due,
			time: parsed.time,
			repeat: parsed.repeat,
			reminder,
		})
		return edit !== null
	} catch (error) {
		reportTaskError("add-task", error)
		return false
	}
}
