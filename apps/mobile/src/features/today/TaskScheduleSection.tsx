import { describeRepeat, type TaskRepeat } from "@cortex/tasks"

import { FormSection } from "@/components/ui/Form"
import { ChoiceRow, DateRow } from "@/features/today/TaskFormControls"
import type { ChoiceOption } from "@/features/today/taskFormTypes"
import {
	type RemindChoice,
	type RepeatChoice,
	remindChoices,
	repeatChoiceOf,
	repeatChoices,
	repeatOfChoice,
	timeChoices,
} from "@/features/today/taskOptions"

const CUSTOM = "custom"

export interface TaskSchedule {
	due?: string
	repeat?: TaskRepeat
	time?: string
}

interface TaskScheduleSectionProps {
	customRemindLabel: string
	onChange: (schedule: TaskSchedule) => void
	onRemindChange: (remind: RemindChoice | typeof CUSTOM) => void
	remind: RemindChoice | typeof CUSTOM
	schedule: TaskSchedule
	today: string
}

function withCustom<T extends string>(
	options: ChoiceOption<T>[],
	isCustom: boolean,
	label: string,
): ChoiceOption<T | typeof CUSTOM>[] {
	return isCustom ? [...options, { label, value: CUSTOM }] : options
}

export function TaskScheduleSection({
	customRemindLabel,
	onChange,
	onRemindChange,
	remind,
	schedule,
	today,
}: TaskScheduleSectionProps) {
	const { due, repeat, time } = schedule
	const repeatChoice = repeatChoiceOf(repeat)
	const timeValue = time ?? "none"
	const timeOptions: ChoiceOption<string>[] = timeChoices.some(
		(choice) => choice.value === timeValue,
	)
		? timeChoices
		: [...timeChoices, { label: timeValue, value: timeValue }]

	const selectDate = (nextDue: string | undefined) => {
		onChange(
			nextDue
				? { ...schedule, due: nextDue }
				: { due: undefined, repeat: undefined, time: undefined },
		)
	}

	const selectTime = (choice: string) => {
		onChange({
			...schedule,
			due: choice === "none" ? due : (due ?? today),
			time: choice === "none" ? undefined : choice,
		})
	}

	const selectRepeat = (choice: RepeatChoice | typeof CUSTOM) => {
		if (choice === CUSTOM) return
		const nextRepeat = repeatOfChoice(choice)
		onChange({ ...schedule, due: nextRepeat ? (due ?? today) : due, repeat: nextRepeat })
	}

	return (
		<FormSection>
			<DateRow
				icon={{ sf: "calendar", md: "calendar_today" }}
				onChange={selectDate}
				title="Due date"
				today={today}
				value={due}
			/>
			{due ? (
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
					repeat ? describeRepeat(repeat) : "Custom",
				)}
				title="Repeat"
				value={repeatChoice}
			/>
			<ChoiceRow
				disabled={!due}
				icon={{ sf: "bell", md: "notifications" }}
				onChange={onRemindChange}
				options={withCustom(remindChoices, remind === CUSTOM, customRemindLabel)}
				title="Remind me"
				value={due ? remind : "none"}
			/>
		</FormSection>
	)
}
