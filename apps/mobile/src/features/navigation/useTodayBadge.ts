import { selectAllTasks, useTasksStore } from "@cortex/core"
import { groupTasks, toIsoDate } from "@cortex/tasks"
import { useMemo } from "react"

export function useTodayBadge(): string | undefined {
	const tasks = useTasksStore(selectAllTasks)
	return useMemo(() => {
		const groups = groupTasks(tasks, toIsoDate(new Date()))
		const count = groups.overdue.length + groups.today.length
		return count > 0 ? String(count) : undefined
	}, [tasks])
}
