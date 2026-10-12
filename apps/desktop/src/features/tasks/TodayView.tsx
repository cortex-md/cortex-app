import { findTaskById, useTasksStore, useVaultStore } from "@cortex/core"
import {
	formatRelativeDay,
	groupTasksByDay,
	parseIsoDate,
	type Task,
	type TaskGroups,
} from "@cortex/tasks"
import { Tabs, TabsList, TabsTrigger } from "@cortex/ui"
import { useMemo } from "react"
import type { CoreViewProps } from "../split-view/coreViewProps"
import { TaskDetailPanel } from "./TaskDetailPanel"
import { TaskQuickAdd } from "./TaskQuickAdd"
import { TaskRow } from "./TaskRow"
import { TaskUndoToast } from "./TaskUndoToast"
import { readTodayViewState, type TodayTab, useTaskGroups } from "./taskModel"

const WEEKDAY_FORMAT = new Intl.DateTimeFormat(undefined, {
	weekday: "long",
	month: "long",
	day: "numeric",
})

const TAB_HEADINGS: Record<TodayTab, { title: string; subtitle?: string }> = {
	today: { title: "Today" },
	upcoming: { title: "Upcoming", subtitle: "Scheduled tasks by day" },
	inbox: { title: "Inbox", subtitle: "Tasks without a date" },
}

interface TaskSection {
	key: string
	label: string
	tasks: Task[]
	overdue?: boolean
	showDate?: boolean
}

function buildSections(tab: TodayTab, groups: TaskGroups, today: string): TaskSection[] {
	let sections: TaskSection[]
	if (tab === "upcoming") {
		sections = groupTasksByDay(groups.upcoming).map((day) => ({
			key: day.date,
			label: formatRelativeDay(day.date, today),
			tasks: day.tasks,
		}))
	} else if (tab === "inbox") {
		sections = [{ key: "inbox", label: "No date", tasks: groups.inbox }]
	} else {
		sections = [
			{ key: "overdue", label: "Overdue", tasks: groups.overdue, overdue: true, showDate: true },
			{ key: "today", label: "Today", tasks: groups.today },
			{ key: "completed", label: "Completed", tasks: groups.completedToday },
		]
	}
	return sections.filter((section) => section.tasks.length > 0)
}

function TaskSectionList({
	section,
	today,
	inboxPath,
	selectedTaskId,
	onSelect,
}: {
	section: TaskSection
	today: string
	inboxPath: string | null
	selectedTaskId: string | null
	onSelect: (task: Task) => void
}) {
	return (
		<section aria-label={section.label}>
			<h2 className="today-section" data-overdue={section.overdue ? "true" : undefined}>
				{section.label}
				<small>{section.tasks.length}</small>
			</h2>
			{section.tasks.map((task) => (
				<TaskRow
					key={task.id}
					task={task}
					today={today}
					inboxPath={inboxPath}
					surface="today"
					showDate={section.showDate}
					selected={task.id === selectedTaskId}
					onOpen={onSelect}
				/>
			))}
		</section>
	)
}

export function TodayView({ viewState, onStateChange }: CoreViewProps) {
	const vault = useVaultStore((state) => state.vault)
	const { groups, today, inboxPath } = useTaskGroups()
	const { tab, selectedTaskId } = readTodayViewState(viewState)

	const sections = useMemo(() => buildSections(tab, groups, today), [groups, tab, today])

	const selectedById = useTasksStore((state) =>
		selectedTaskId ? findTaskById(state, selectedTaskId) : undefined,
	)
	const selectedTask = selectedById ?? sections[0]?.tasks[0]
	const counts: Record<TodayTab, number> = {
		today: groups.overdue.length + groups.today.length,
		upcoming: groups.upcoming.length,
		inbox: groups.inbox.length,
	}
	const heading = TAB_HEADINGS[tab]
	const subtitle = heading.subtitle ?? WEEKDAY_FORMAT.format(parseIsoDate(today))

	const handleSelectTab = (value: string) => {
		onStateChange({ ...viewState, tab: value, selectedTaskId: null })
	}

	const handleSelectTask = (task: Task) => {
		onStateChange({ ...viewState, selectedTaskId: task.id })
	}

	if (!vault) return null

	return (
		<div className="today-view">
			<div className="today-main">
				<div className="today-column">
					<header className="today-head">
						<h1>{heading.title}</h1>
						<span>{subtitle}</span>
					</header>
					<Tabs value={tab} onValueChange={handleSelectTab} className="today-tabs">
						<TabsList aria-label="Task views">
							{(Object.keys(TAB_HEADINGS) as TodayTab[]).map((key) => (
								<TabsTrigger key={key} value={key}>
									{TAB_HEADINGS[key].title}
									<span className="today-tab-count">{counts[key]}</span>
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
					<TaskQuickAdd
						variant="page"
						today={today}
						placeholder="Add a task — try “Pay rent every month on the 5th”"
					/>
					{sections.length === 0 ? (
						<p className="task-empty">
							{tab === "today" ? "Nothing left for today." : "No tasks here yet."}
						</p>
					) : (
						sections.map((section) => (
							<TaskSectionList
								key={section.key}
								section={section}
								today={today}
								inboxPath={inboxPath}
								selectedTaskId={selectedTask?.id ?? null}
								onSelect={handleSelectTask}
							/>
						))
					)}
				</div>
			</div>
			<TaskDetailPanel task={selectedTask} today={today} inboxPath={inboxPath} />
			<TaskUndoToast surface="today" />
		</div>
	)
}
