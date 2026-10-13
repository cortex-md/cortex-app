export type NotificationPermissionState = "prompt" | "granted" | "denied"

export interface NotificationChannel {
	id: string
	label: string
}

export const notificationChannels: NotificationChannel[] = [
	{ id: "reminders", label: "Reminders" },
	{ id: "digest", label: "Daily digest" },
	{ id: "mentions", label: "Mentions" },
]

export const testReminderFixture = {
	title: "Draft the announcement",
	body: "Due 10:00 · Launch plan",
}

export const exactAlarmsFixture = {
	allowed: true,
	subtitle: "Allowed · reminders fire on the minute",
}
