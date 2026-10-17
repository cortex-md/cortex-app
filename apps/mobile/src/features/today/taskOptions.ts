import {
	type ClockTime,
	detectReminderPreset,
	isSameRepeat,
	type ReminderPreset,
	type TaskFields,
	type TaskRepeat,
} from "@cortex/tasks"

export type RepeatChoice = "none" | "day" | "week" | "month" | "3days"

export const repeatChoices: { label: string; repeat?: TaskRepeat; value: RepeatChoice }[] = [
	{ label: "None", value: "none" },
	{ label: "Daily", repeat: { unit: "day", interval: 1 }, value: "day" },
	{ label: "Weekly", repeat: { unit: "week", interval: 1 }, value: "week" },
	{ label: "Monthly", repeat: { unit: "month", interval: 1 }, value: "month" },
	{ label: "Every 3 days", repeat: { unit: "day", interval: 3 }, value: "3days" },
]

export function repeatChoiceOf(repeat: TaskRepeat | undefined): RepeatChoice | "custom" {
	if (!repeat) return "none"
	return repeatChoices.find((choice) => isSameRepeat(choice.repeat, repeat))?.value ?? "custom"
}

export function repeatOfChoice(choice: RepeatChoice): TaskRepeat | undefined {
	return repeatChoices.find((candidate) => candidate.value === choice)?.repeat
}

export type RemindChoice = "none" | "at" | "15" | "morning"

export const remindChoices: { label: string; value: RemindChoice }[] = [
	{ label: "None", value: "none" },
	{ label: "At time", value: "at" },
	{ label: "15 min before", value: "15" },
	{ label: "Morning of", value: "morning" },
]

const REMIND_LABELS: Record<ReminderPreset, string> = {
	at: "At time",
	"5": "5 min before",
	"15": "15 min before",
	"60": "1 hour before",
	morning: "Morning of",
}

export function remindChoiceOf(
	fields: Pick<TaskFields, "due" | "time" | "reminder">,
	untimedReminderTime: ClockTime,
): RemindChoice | "custom" {
	const preset = detectReminderPreset(fields, untimedReminderTime)
	if (preset === null) return "none"
	if (preset === "at" || preset === "15" || preset === "morning") return preset
	return "custom"
}

export function describeRemindChoice(
	choice: RemindChoice | "custom",
	fields: Pick<TaskFields, "due" | "time" | "reminder">,
	untimedReminderTime: ClockTime,
): string {
	if (choice === "none") return "None"
	if (choice !== "custom") return REMIND_LABELS[choice]
	const preset = detectReminderPreset(fields, untimedReminderTime)
	if (preset && preset !== "custom") return REMIND_LABELS[preset]
	return fields.reminder?.time ?? "Custom"
}

export const timeChoices: { label: string; value: string }[] = [
	{ label: "None", value: "none" },
	{ label: "9:00", value: "09:00" },
	{ label: "13:00", value: "13:00" },
	{ label: "17:00", value: "17:00" },
]
