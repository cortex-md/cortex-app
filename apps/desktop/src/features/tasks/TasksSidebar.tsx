import { useVaultStore } from "@cortex/core"
import type { Task } from "@cortex/tasks"
import {
	Button,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuTrigger,
	Kbd,
} from "@cortex/ui"
import { FilterIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useCommandHotkey } from "@/hooks/useCommandHotkey"
import { SidebarNoVaultState } from "../sidebar/SidebarToolView"
import { TaskQuickAdd, TaskQuickAddTrigger } from "./TaskQuickAdd"
import { TaskRow } from "./TaskRow"
import { TaskUndoToast } from "./TaskUndoToast"
import { openTaskInNote, openTodayView, taskQuickAddFocus, useTaskGroups } from "./taskModel"

const ADD_TASK_COMMAND_ID = "tasks.add"
const OPEN_TODAY_COMMAND_ID = "tasks.open-today"

interface TaskSidebarGroupProps {
	label: string
	tasks: Task[]
	today: string
	inboxPath: string | null
	overdue?: boolean
	onOpen: (task: Task) => void
}

function TaskSidebarGroup({
	label,
	tasks,
	today,
	inboxPath,
	overdue,
	onOpen,
}: TaskSidebarGroupProps) {
	if (tasks.length === 0) return null
	const openCount = tasks.filter((task) => task.status === "open").length
	return (
		<section aria-label={label}>
			<h3 className="task-sidebar-group" data-overdue={overdue ? "true" : undefined}>
				{label}
				<b>{openCount}</b>
			</h3>
			<div className="task-sidebar-list">
				{tasks.map((task) => (
					<TaskRow
						key={task.id}
						task={task}
						today={today}
						inboxPath={inboxPath}
						surface="sidebar"
						onOpen={onOpen}
					/>
				))}
			</div>
		</section>
	)
}

function TasksSidebarFilter({
	showCompleted,
	onShowCompletedChange,
}: {
	showCompleted: boolean
	onShowCompletedChange: (value: boolean) => void
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon-xs"
					className="sidebar-tool-action"
					aria-label="Filter tasks"
				>
					<FilterIcon />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>Show</DropdownMenuLabel>
				<DropdownMenuCheckboxItem checked={showCompleted} onCheckedChange={onShowCompletedChange}>
					Completed today
				</DropdownMenuCheckboxItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function TasksSidebar() {
	const vault = useVaultStore((state) => state.vault)
	const { groups, today, inboxPath } = useTaskGroups()
	const addTaskHotkey = useCommandHotkey(ADD_TASK_COMMAND_ID)
	const openTodayHotkey = useCommandHotkey(OPEN_TODAY_COMMAND_ID)
	const quickAddRef = useRef<HTMLInputElement>(null)
	const focusRequest = taskQuickAddFocus.useTarget()
	const [composing, setComposing] = useState(false)
	const [showCompleted, setShowCompleted] = useState(false)

	useEffect(() => {
		if (focusRequest === null) return
		setComposing(true)
		quickAddRef.current?.focus()
		taskQuickAddFocus.close()
	}, [focusRequest])

	if (!vault) return <SidebarNoVaultState />

	const handleOpen = (task: Task) => openTaskInNote(task, inboxPath)
	const nothingDue = groups.overdue.length + groups.today.length === 0

	return (
		<div className="sidebar-tool-view task-sidebar">
			<div className="sidebar-tool-header">
				<div className="sidebar-tool-title-row">
					<span className="sidebar-tool-title">Tasks</span>
					<span className="sidebar-tool-title-actions">
						<TasksSidebarFilter
							showCompleted={showCompleted}
							onShowCompletedChange={setShowCompleted}
						/>
					</span>
				</div>
				{composing ? (
					<TaskQuickAdd
						variant="sidebar"
						today={today}
						inputRef={quickAddRef}
						onDismiss={() => setComposing(false)}
					/>
				) : (
					<TaskQuickAddTrigger shortcut={addTaskHotkey} onActivate={() => setComposing(true)} />
				)}
			</div>
			<div className="sidebar-tool-scroll task-sidebar-scroll">
				<TaskSidebarGroup
					label="Overdue"
					tasks={groups.overdue}
					today={today}
					inboxPath={inboxPath}
					overdue
					onOpen={handleOpen}
				/>
				<TaskSidebarGroup
					label="Today"
					tasks={groups.today}
					today={today}
					inboxPath={inboxPath}
					onOpen={handleOpen}
				/>
				{showCompleted && (
					<TaskSidebarGroup
						label="Completed"
						tasks={groups.completedToday}
						today={today}
						inboxPath={inboxPath}
						onOpen={handleOpen}
					/>
				)}
				{nothingDue && <p className="task-sidebar-empty">Nothing due today.</p>}
				<Button
					variant="ghost"
					className="task-sidebar-group task-sidebar-group-link"
					onClick={() => openTodayView("upcoming")}
				>
					Upcoming
					<b>{groups.upcoming.length}</b>
				</Button>
			</div>
			<TaskUndoToast surface="sidebar" />
			<Button variant="ghost" className="task-sidebar-open" onClick={() => openTodayView()}>
				<span>Open Today</span>
				{openTodayHotkey && <Kbd className="task-kbd">{openTodayHotkey}</Kbd>}
			</Button>
		</div>
	)
}

export function TasksRailBadge() {
	const { groups } = useTaskGroups()
	const count = groups.overdue.length + groups.today.length
	if (count === 0) return null
	return (
		<span className="sidebar-rail-badge" aria-hidden="true">
			{count > 99 ? "99+" : count}
		</span>
	)
}
