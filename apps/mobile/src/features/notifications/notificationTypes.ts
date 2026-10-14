export type NotificationPermissionState = "prompt" | "granted" | "denied"

export interface NotificationChannel {
	id: string
	label: string
}

export const REMINDER_CHANNEL: NotificationChannel = { id: "reminders", label: "Task reminders" }

export const TEST_REMINDER = {
	title: "Test reminder",
	body: "Task reminders from Cortex look like this.",
}
