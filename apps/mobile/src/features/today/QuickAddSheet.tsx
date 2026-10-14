import { useSettingsStore } from "@cortex/settings"
import {
	isSameRepeat,
	parseQuickAdd,
	type QuickAddResult,
	resolveReminderPreset,
	type TaskReminder,
	toIsoDate,
} from "@cortex/tasks"
import { useMemo, useState } from "react"
import { Alert } from "react-native"

import { FormRow, FormSection } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { dismissSheet } from "@/features/navigation/routes"
import { submitQuickAdd } from "@/features/today/quickAddActions"
import { SheetToolbar } from "@/features/today/SheetToolbar"
import { TaskForm } from "@/features/today/TaskFormControls"
import { type TaskSchedule, TaskScheduleSection } from "@/features/today/TaskScheduleSection"
import {
	describeRemindChoice,
	type RemindChoice,
	remindChoiceOf,
} from "@/features/today/taskOptions"

const PLACEHOLDER = "Call Ana tomorrow at 3pm"

type Override<T> = T | null | undefined

interface ScheduleOverrides {
	due?: Override<string>
	repeat?: Override<QuickAddResult["repeat"]>
	time?: Override<string>
}

function pick<T>(parsed: T | undefined, override: Override<T>): T | undefined {
	if (override === undefined) return parsed
	return override ?? undefined
}

function applyOverrides(parsed: QuickAddResult, overrides: ScheduleOverrides): QuickAddResult {
	return {
		title: parsed.title,
		due: pick(parsed.due, overrides.due),
		repeat: pick(parsed.repeat, overrides.repeat),
		time: pick(parsed.time, overrides.time),
	}
}

function overridesAfter(
	current: TaskSchedule,
	next: TaskSchedule,
	overrides: ScheduleOverrides,
): ScheduleOverrides {
	const result = { ...overrides }
	if (next.due !== current.due) result.due = next.due ?? null
	if (next.time !== current.time) result.time = next.time ?? null
	if (!isSameRepeat(next.repeat, current.repeat)) result.repeat = next.repeat ?? null
	return result
}

export function QuickAddSheet() {
	const today = toIsoDate(new Date())
	const tasksSettings = useSettingsStore((state) => state.settings.tasks)
	const [draft, setDraft] = useState("")
	const [overrides, setOverrides] = useState<ScheduleOverrides>({})
	const [remindOverride, setRemindOverride] = useState<RemindChoice | undefined>(undefined)
	const [submitting, setSubmitting] = useState(false)
	const parsed = useMemo(() => parseQuickAdd(draft.trim(), today), [draft, today])
	const result = applyOverrides(parsed, overrides)
	const { untimedReminderTime } = tasksSettings
	const defaultReminder =
		result.due && result.time
			? resolveReminderPreset(
					tasksSettings.defaultReminder,
					result.due,
					result.time,
					untimedReminderTime,
				)
			: undefined
	const reminderFields = { due: result.due, time: result.time, reminder: defaultReminder }
	const remind = remindOverride ?? remindChoiceOf(reminderFields, untimedReminderTime)
	const hasTokens = Boolean(parsed.due || parsed.time || parsed.repeat)
	const canAdd = result.title.length > 0 && !submitting

	const reminderToApply = (): TaskReminder | null | undefined => {
		if (remindOverride === undefined || !result.due) return undefined
		if (remindOverride === "none") return null
		return resolveReminderPreset(remindOverride, result.due, result.time, untimedReminderTime)
	}

	const handleAdd = () => {
		if (!canAdd) return
		setSubmitting(true)
		void submitQuickAdd(result, reminderToApply()).then((added) => {
			if (added) {
				dismissSheet()
				toast("Added to Inbox")
				return
			}
			setSubmitting(false)
			Alert.alert("Couldn't add the task", "The vault's task inbox is not ready yet. Try again.")
		})
	}

	return (
		<>
			<SheetToolbar
				confirmDisabled={!canAdd}
				confirmLabel="Add"
				onCancel={dismissSheet}
				onConfirm={handleAdd}
				title="New task"
			/>
			<TaskForm
				autoFocus
				initialTitle=""
				onSubmitTitle={handleAdd}
				onTitleChange={setDraft}
				placeholder={PLACEHOLDER}
			>
				{hasTokens ? (
					<FormSection title="Detected">
						<FormRow
							icon={{ sf: "checklist", md: "checklist" }}
							title={parsed.title || "No title"}
						/>
					</FormSection>
				) : null}
				<TaskScheduleSection
					customRemindLabel={describeRemindChoice("custom", reminderFields, untimedReminderTime)}
					onChange={(next) => setOverrides((current) => overridesAfter(result, next, current))}
					onRemindChange={(choice) => {
						if (choice !== "custom") setRemindOverride(choice)
					}}
					remind={remind}
					schedule={{ due: result.due, repeat: result.repeat, time: result.time }}
					today={today}
				/>
			</TaskForm>
		</>
	)
}
