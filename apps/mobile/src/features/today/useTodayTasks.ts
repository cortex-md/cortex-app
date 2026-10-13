import {
	getTaskSource,
	revertTaskEditSafely,
	selectAllTasks,
	toggleTaskWithUndo,
	useTasksStore,
} from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import {
	formatRelativeDay,
	groupTasks,
	groupTasksByDay,
	parseIsoDate,
	type Task,
	toIsoDate,
} from "@cortex/tasks"
import { useMemo } from "react"

import { toastWithUndo } from "@/features/feedback/useToast"

export type TodayTabKey = "today" | "upcoming" | "inbox"

export interface TaskSection {
	data: Task[]
	key: string
	overdue: boolean
	showDate: boolean
	title: string
}

export const todayTabTitles: Record<TodayTabKey, string> = {
	inbox: "Inbox",
	today: "Today",
	upcoming: "Upcoming",
}

export function describeTodaySubhead(tab: TodayTabKey, today: string): string {
	if (tab === "upcoming") return "Next 7 days"
	if (tab === "inbox") return "Tasks without a date"
	return parseIsoDate(today).toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	})
}

export function useTodayTasks(tab: TodayTabKey) {
	const tasks = useTasksStore(selectAllTasks)
	const inboxPath = useTasksStore((state) => state.inboxPath)
	const untimedReminderTime = useSettingsStore(
		(state) => state.settings.tasks.untimedReminderTime,
	)
	const today = toIsoDate(new Date())
	const groups = useMemo(() => groupTasks(tasks, today), [tasks, today])

	const counts = useMemo(
		() => ({
			inbox: groups.inbox.length,
			today: groups.overdue.length + groups.today.length,
			upcoming: groups.upcoming.length,
		}),
		[groups],
	)

	const sections = useMemo<TaskSection[]>(() => {
		if (tab === "today") {
			return [
				{ data: groups.overdue, key: "overdue", overdue: true, showDate: true, title: "Overdue" },
				{ data: groups.today, key: "today", overdue: false, showDate: false, title: "Today" },
				{
					data: groups.completedToday,
					key: "completed",
					overdue: false,
					showDate: false,
					title: "Completed",
				},
			].filter((section) => section.data.length > 0)
		}
		if (tab === "upcoming") {
			return groupTasksByDay(groups.upcoming).map((day) => ({
				data: day.tasks,
				key: day.date,
				overdue: false,
				showDate: false,
				title: formatRelativeDay(day.date, today),
			}))
		}
		return groups.inbox.length > 0
			? [{ data: groups.inbox, key: "inbox", overdue: false, showDate: false, title: "No date" }]
			: []
	}, [groups, tab, today])

	return { counts, inboxPath, sections, today, untimedReminderTime }
}

export async function completeTask(task: Task, inboxPath: string | null): Promise<void> {
	await toggleTaskWithUndo(task, inboxPath, (message, edit) => {
		const text = edit.nextDue ? message : `Checked off in ${getTaskSource(task, inboxPath)}.md`
		toastWithUndo(text, () => void revertTaskEditSafely(edit))
	})
}
