import {
	revertTaskEditSafely,
	selectAllTasks,
	type TaskLineEdit,
	toggleTaskWithUndo,
	useTasksStore,
	useUIStore,
} from "@cortex/core"
import { groupTasks, type Task, type TaskGroups } from "@cortex/tasks"
import { useMemo } from "react"
import { useLocalToday } from "@/hooks/useMinuteNow"
import { createModalStore } from "@/utils/createModalStore"

export {
	addTaskFromQuickAdd,
	describeSidebarTaskTime,
	describeTaskReminder,
	getTaskSource,
	isInboxTask,
	openTaskInNote,
	openTodayView,
	readTodayViewState,
	TODAY_VIEW_ID,
	type TodayTab,
	type TodayViewState,
	toggleTaskInNote,
} from "@cortex/core"

export const TASKS_SIDEBAR_VIEW_ID = "tasks"

export type TaskSurface = "sidebar" | "today"

export interface TaskUndoTarget {
	surface: TaskSurface
	message: string
	edit: TaskLineEdit
}

export const taskUndoToast = createModalStore<TaskUndoTarget>()
export const taskQuickAddFocus = createModalStore<number>()

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

export async function toggleTaskFrom(
	surface: TaskSurface,
	task: Task,
	inboxPath: string | null,
): Promise<void> {
	await toggleTaskWithUndo(task, inboxPath, (message, edit) =>
		taskUndoToast.open({ surface, message, edit }),
	)
}

export async function undoTaskEdit(target: TaskUndoTarget): Promise<void> {
	taskUndoToast.close()
	await revertTaskEditSafely(target.edit)
}
