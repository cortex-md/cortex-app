import type { IsoDate, Task } from "./types"

export interface TaskGroups {
	overdue: Task[]
	today: Task[]
	completedToday: Task[]
	upcoming: Task[]
	inbox: Task[]
}

export interface TaskDaySection {
	date: IsoDate
	tasks: Task[]
}

function compareByTimeThenTitle(left: Task, right: Task): number {
	const leftTime = left.time ?? "99:99"
	const rightTime = right.time ?? "99:99"
	if (leftTime !== rightTime) return leftTime < rightTime ? -1 : 1
	return left.title.localeCompare(right.title)
}

function compareByDueThenTime(left: Task, right: Task): number {
	const leftDue = left.due ?? ""
	const rightDue = right.due ?? ""
	if (leftDue !== rightDue) return leftDue < rightDue ? -1 : 1
	return compareByTimeThenTitle(left, right)
}

export function groupTasks(tasks: Iterable<Task>, today: IsoDate): TaskGroups {
	const groups: TaskGroups = { overdue: [], today: [], completedToday: [], upcoming: [], inbox: [] }
	for (const task of tasks) {
		if (task.status === "done") {
			if (task.doneDate === today) groups.completedToday.push(task)
		} else if (!task.due) groups.inbox.push(task)
		else if (task.due < today) groups.overdue.push(task)
		else if (task.due === today) groups.today.push(task)
		else groups.upcoming.push(task)
	}
	groups.overdue.sort(compareByDueThenTime)
	groups.today.sort(compareByTimeThenTitle)
	groups.completedToday.sort(compareByTimeThenTitle)
	groups.upcoming.sort(compareByDueThenTime)
	groups.inbox.sort((left, right) => left.title.localeCompare(right.title))
	return groups
}

export function groupTasksByDay(tasks: readonly Task[]): TaskDaySection[] {
	const sections: TaskDaySection[] = []
	for (const task of tasks) {
		if (!task.due) continue
		const last = sections.at(-1)
		if (last?.date === task.due) last.tasks.push(task)
		else sections.push({ date: task.due, tasks: [task] })
	}
	return sections
}
