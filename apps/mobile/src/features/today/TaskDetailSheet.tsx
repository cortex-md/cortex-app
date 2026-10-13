import { findTaskById, getTaskSource, reportAppError, useTasksStore } from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import {
	describeRepeat,
	isSameRepeat,
	resolveReminderPreset,
	type Task,
	type TaskPatch,
	type TaskRepeat,
	type TaskStatus,
	toIsoDate,
} from "@cortex/tasks"
import { useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { Alert, StyleSheet, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { FormRow, FormSection, FormToggle } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { dismissSheet, openNote } from "@/features/navigation/routes"
import { SheetToolbar } from "@/features/today/SheetToolbar"
import { ChoiceRow, DateRow, TaskForm } from "@/features/today/TaskFormControls"
import type { ChoiceOption } from "@/features/today/taskFormTypes"
import {
	describeRemindChoice,
	type RemindChoice,
	remindChoiceOf,
	remindChoices,
	type RepeatChoice,
	repeatChoiceOf,
	repeatChoices,
	repeatOfChoice,
	timeChoices,
} from "@/features/today/taskOptions"
import { useMobileColors } from "@/hooks/useMobileColors"

const CUSTOM = "custom"

interface TaskDraft {
	due?: string
	remind: RemindChoice | "custom"
	repeat?: TaskRepeat
	status: TaskStatus
	time?: string
	title: string
}

function draftFromTask(task: Task, untimedReminderTime: string): TaskDraft {
	return {
		due: task.due,
		remind: remindChoiceOf(task, untimedReminderTime),
		repeat: task.repeat,
		status: task.status,
		time: task.time,
		title: task.title,
	}
}

function buildPatch(
	task: Task,
	draft: TaskDraft,
	untimedReminderTime: string,
	today: string,
): TaskPatch {
	const patch: TaskPatch = {}
	const title = draft.title.trim()
	if (title && title !== task.title) patch.title = title
	if (draft.status !== task.status) {
		patch.status = draft.status
		patch.doneDate = draft.status === "done" ? today : null
	}
	if ((draft.due ?? null) !== (task.due ?? null)) patch.due = draft.due ?? null
	if ((draft.time ?? null) !== (task.time ?? null)) patch.time = draft.time ?? null
	if (!isSameRepeat(draft.repeat, task.repeat)) patch.repeat = draft.repeat ?? null
	if (draft.remind === "custom") return patch
	if (draft.remind === "none" || !draft.due) {
		if (task.reminder) patch.reminder = null
		return patch
	}
	const reminder = resolveReminderPreset(draft.remind, draft.due, draft.time, untimedReminderTime)
	if (
		task.reminder?.time !== reminder.time ||
		(task.reminder?.date ?? undefined) !== reminder.date ||
		patch.due !== undefined ||
		patch.time !== undefined
	) {
		patch.reminder = reminder
	}
	return patch
}

async function saveTask(task: Task, patch: TaskPatch): Promise<void> {
	if (Object.keys(patch).length === 0) return
	try {
		await useTasksStore.getState().updateTask(task, patch)
	} catch (cause) {
		await reportAppError({
			operation: "update-task",
			source: "tasks",
			cause,
			userMessage: "Cortex could not update this task. The note may have changed or be read-only.",
		})
	}
}

async function deleteTask(task: Task): Promise<void> {
	try {
		const edit = await useTasksStore.getState().transformTask(task, () => "")
		if (edit) toast("Task deleted")
	} catch (cause) {
		await reportAppError({
			operation: "delete-task",
			source: "tasks",
			cause,
			userMessage: "Cortex could not delete this task. The note may have changed or be read-only.",
		})
	}
}

function confirmDelete(task: Task, source: string): void {
	Alert.alert("Delete task?", `“${task.title}” will be removed from ${source}.`, [
		{ style: "cancel", text: "Cancel" },
		{
			onPress: () => {
				dismissSheet()
				void deleteTask(task)
			},
			style: "destructive",
			text: "Delete",
		},
	])
}

function openTaskNote(task: Task): void {
	dismissSheet()
	openNote(task.path)
}

function withCustom<T extends string>(
	options: ChoiceOption<T>[],
	isCustom: boolean,
	label: string,
): ChoiceOption<T | typeof CUSTOM>[] {
	return isCustom ? [...options, { label, value: CUSTOM }] : options
}

function TaskDetailForm({ task }: { task: Task }) {
	const inboxPath = useTasksStore((state) => state.inboxPath)
	const untimedReminderTime = useSettingsStore((state) => state.settings.tasks.untimedReminderTime)
	const today = toIsoDate(new Date())
	const [draft, setDraft] = useState<TaskDraft>(() => draftFromTask(task, untimedReminderTime))
	const source = `${getTaskSource(task, inboxPath)}.md`
	const repeatChoice = repeatChoiceOf(draft.repeat)
	const timeValue = draft.time ?? "none"
	const timeOptions: ChoiceOption<string>[] = timeChoices.some(
		(choice) => choice.value === timeValue,
	)
		? timeChoices
		: [...timeChoices, { label: timeValue, value: timeValue }]

	const update = (next: Partial<TaskDraft>) => setDraft((current) => ({ ...current, ...next }))

	const handleSave = () => {
		const patch = buildPatch(task, draft, untimedReminderTime, today)
		void saveTask(task, patch).then(dismissSheet)
	}

	const selectRepeat = (choice: RepeatChoice | typeof CUSTOM) => {
		if (choice === CUSTOM) return
		const repeat = repeatOfChoice(choice)
		update({ repeat, due: repeat ? (draft.due ?? today) : draft.due })
	}

	const selectTime = (choice: string) => {
		update({
			due: choice === "none" ? draft.due : (draft.due ?? today),
			time: choice === "none" ? undefined : choice,
		})
	}

	const selectDate = (due: string | undefined) => {
		update(due ? { due } : { due: undefined, repeat: undefined, time: undefined })
	}

	return (
		<>
			<SheetToolbar
				confirmLabel="Done"
				onCancel={dismissSheet}
				onConfirm={handleSave}
				title="Task"
			/>
			<TaskForm
				initialTitle={task.title}
				onTitleChange={(title) => update({ title })}
				placeholder="Task"
			>
				<FormSection>
					<FormToggle
						icon={{ sf: "checkmark.circle", md: "task_alt" }}
						onValueChange={(done) => update({ status: done ? "done" : "open" })}
						title="Completed"
						value={draft.status === "done"}
					/>
				</FormSection>
				<FormSection>
					<DateRow
						icon={{ sf: "calendar", md: "calendar_today" }}
						onChange={selectDate}
						title="Due date"
						today={today}
						value={draft.due}
					/>
					{draft.due ? (
						<ChoiceRow
							icon={{ sf: "clock", md: "schedule" }}
							onChange={selectTime}
							options={timeOptions}
							title="Time"
							value={timeValue}
						/>
					) : null}
					<ChoiceRow
						icon={{ sf: "repeat", md: "repeat" }}
						onChange={selectRepeat}
						options={withCustom(
							repeatChoices,
							repeatChoice === CUSTOM,
							draft.repeat ? describeRepeat(draft.repeat) : "Custom",
						)}
						title="Repeat"
						value={repeatChoice}
					/>
					<ChoiceRow
						disabled={!draft.due}
						icon={{ sf: "bell", md: "notifications" }}
						onChange={(remind) => update({ remind })}
						options={withCustom(
							remindChoices,
							draft.remind === CUSTOM,
							describeRemindChoice(CUSTOM, task, untimedReminderTime),
						)}
						title="Remind me"
						value={draft.due ? draft.remind : "none"}
					/>
				</FormSection>
				<FormSection>
					<FormRow
						chevron
						icon={{ sf: "doc.text", md: "description" }}
						onPress={() => openTaskNote(task)}
						title="Open note"
						value={source}
					/>
					<FormRow
						destructive
						icon={{ sf: "trash", md: "delete" }}
						onPress={() => confirmDelete(task, source)}
						title="Delete task"
					/>
				</FormSection>
			</TaskForm>
		</>
	)
}

export function TaskDetailSheet() {
	const { colors } = useMobileColors()
	const { taskId } = useLocalSearchParams<{ taskId?: string }>()
	const task = useTasksStore((state) => (taskId ? findTaskById(state, taskId) : undefined))

	if (!task) {
		return (
			<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
				<SheetToolbar onCancel={dismissSheet} title="Task" />
				<EmptyState
					description="The line was removed from its note or the note is no longer indexed."
					title="Task not found"
				/>
			</View>
		)
	}

	return <TaskDetailForm key={task.id} task={task} />
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
})
