import { reportAppError } from "@cortex/core"
import { type AppSettings, useSettingsStore } from "@cortex/settings"
import { Stack } from "expo-router"
import { useEffect } from "react"
import { Platform } from "react-native"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { promptNotificationPermission } from "@/features/notifications/notificationPermissionPrompt"
import {
	getExactAlarmsState,
	loadNotificationPermission,
	openSystemNotificationSettings,
	sendTestReminder,
	useNotificationPermission,
} from "@/features/notifications/notificationsAdapter"
import { ChoiceRow } from "@/features/today/TaskFormControls"
import type { ChoiceOption } from "@/features/today/taskFormTypes"

const IS_IOS = Platform.OS === "ios"
const FOOTER =
	"Reminders fire on the device that is awake; other devices clear it when one handles it."

type TasksSettings = AppSettings["tasks"]
type DefaultReminder = TasksSettings["defaultReminder"]

const defaultReminderOptions: ChoiceOption<DefaultReminder>[] = [
	{ label: "At time", value: "at" },
	{ label: "5 min before", value: "5" },
	{ label: "15 min before", value: "15" },
	{ label: "1 hour before", value: "60" },
]

const digestTimeOptions: ChoiceOption<string>[] = [
	{ label: "07:30", value: "07:30" },
	{ label: "08:30", value: "08:30" },
	{ label: "09:00", value: "09:00" },
]

function updateTaskSetting<K extends keyof TasksSettings>(key: K, value: TasksSettings[K]): void {
	void useSettingsStore
		.getState()
		.updateSetting("tasks", key, value)
		.catch((cause: unknown) =>
			reportAppError({
				operation: "update-setting",
				source: "mobile-notifications",
				cause,
				userMessage: "Unable to save this setting.",
			}),
		)
}

function handleTest(): void {
	void sendTestReminder().then((sent) => {
		if (sent) toast("Test reminder sent")
	})
}

function withCurrent(options: ChoiceOption<string>[], value: string): ChoiceOption<string>[] {
	return options.some((option) => option.value === value)
		? options
		: [...options, { label: value, value }]
}

function PermissionRow() {
	const permission = useNotificationPermission()
	if (permission === "granted") {
		return (
			<FormRow
				chevron
				icon={{ sf: "bell.badge", md: "notifications_active" }}
				onPress={() => void openSystemNotificationSettings()}
				title="Notifications"
				value="Allowed"
			/>
		)
	}
	if (permission === "denied") {
		return (
			<FormRow
				chevron
				icon={{ sf: "bell.slash", md: "notifications_off" }}
				onPress={() => void openSystemNotificationSettings()}
				title="Notifications"
				value="Off"
			/>
		)
	}
	return (
		<FormRow
			icon={{ sf: "bell", md: "notifications" }}
			onPress={promptNotificationPermission}
			tint
			title="Allow notifications"
		/>
	)
}

export function NotificationsSettingsScreen() {
	const tasks = useSettingsStore((state) => state.settings.tasks)
	const exactAlarms = getExactAlarmsState()

	useEffect(() => {
		void loadNotificationPermission()
	}, [])

	return (
		<>
			<Stack.Screen options={{ title: "Notifications" }} />
			<NativeForm>
				<FormSection>
					<PermissionRow />
				</FormSection>
				<FormSection title="Reminders">
					<FormToggle
						onValueChange={(value) => updateTaskSetting("remindersEnabled", value)}
						subtitle="For tasks with a date and a ⏰"
						title="Task reminders"
						value={tasks.remindersEnabled}
					/>
					<ChoiceRow
						disabled={!tasks.remindersEnabled}
						onChange={(value) => updateTaskSetting("defaultReminder", value)}
						options={defaultReminderOptions}
						title="Default reminder"
						value={tasks.defaultReminder}
					/>
					<FormRow title="Tasks without a time" value={tasks.untimedReminderTime} />
					{IS_IOS ? null : <FormRow subtitle={exactAlarms.subtitle} title="Exact alarms" />}
				</FormSection>
				<FormSection title="Daily digest">
					<FormToggle
						onValueChange={(value) => updateTaskSetting("digestEnabled", value)}
						subtitle="Today and overdue tasks in one notification"
						title="Daily digest"
						value={tasks.digestEnabled}
					/>
					{tasks.digestEnabled ? (
						<ChoiceRow
							onChange={(value) => updateTaskSetting("digestTime", value)}
							options={withCurrent(digestTimeOptions, tasks.digestTime)}
							title="Time"
							value={tasks.digestTime}
						/>
					) : null}
				</FormSection>
				<FormSection footer={FOOTER} title="Other">
					<FormToggle
						onValueChange={(value) => updateTaskSetting("mentionsEnabled", value)}
						subtitle="When someone @mentions you or replies"
						title="Mentions and comments"
						value={tasks.mentionsEnabled}
					/>
					<FormToggle
						onValueChange={(value) => updateTaskSetting("quietHoursEnabled", value)}
						subtitle={
							tasks.quietHoursEnabled
								? `${tasks.quietHoursStart} – ${tasks.quietHoursEnd}`
								: undefined
						}
						title="Quiet hours"
						value={tasks.quietHoursEnabled}
					/>
					<FormToggle
						onValueChange={(value) => updateTaskSetting("sound", value)}
						title="Play a sound"
						value={tasks.sound}
					/>
					<FormRow onPress={handleTest} tint title="Send a test reminder" />
				</FormSection>
			</NativeForm>
		</>
	)
}
