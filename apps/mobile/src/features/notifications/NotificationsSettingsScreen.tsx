import { reportAppError } from "@cortex/core"
import { type AppSettings, useSettingsStore } from "@cortex/settings"
import { FieldGroup, Host } from "@expo/ui"
import { Stack } from "expo-router"
import { Bell, BellRing, Clock } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { Badge } from "@/components/ui/Badge"
import { GroupedFooter, GroupedList, GroupedRow } from "@/components/ui/GroupedList"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { SettingsRow } from "@/components/ui/SettingsRow"
import { NotificationPermissionPrompt } from "@/features/notifications/NotificationPermissionPrompt"
import {
	getExactAlarmsState,
	listNotificationChannels,
	loadNotificationPermission,
	openSystemNotificationSettings,
	requestNotificationPermission,
	sendTestReminder,
	useNotificationPermission,
} from "@/features/notifications/notificationsAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const PLATFORM_NAME = IS_IOS ? "iOS" : "Android"
const DEVICE_NAME = IS_IOS ? "iPhone" : "phone"

type TasksSettings = AppSettings["tasks"]
type DefaultReminder = TasksSettings["defaultReminder"]

const INTRO = `Reminders are read from ⏰ on tasks in any note and delivered by ${PLATFORM_NAME}, even when Cortex is in the background.`
const PERMISSION_ASK = `Cortex needs permission to show notifications on this ${DEVICE_NAME}.`
const TEST_SENT = IS_IOS
	? "Sent. Lock your iPhone to see it."
	: "Sent. Pull down the notification shade to see it."
const FOOTER = "Reminders fire on the device that is awake; other devices clear it when one handles it."
const SOUND_SUBTITLE = IS_IOS ? "Uses the iOS notification sound" : "Uses the channel sound"

const defaultReminderOptions: { label: string; value: DefaultReminder }[] = [
	{ label: "At time", value: "at" },
	{ label: "5 min", value: "5" },
	{ label: "15 min", value: "15" },
	{ label: "1 hour", value: "60" },
]

const digestTimeOptions = [
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

function PermissionCard({ onAllow }: { onAllow: () => void }) {
	const { colors } = useMobileColors()
	const Icon = IS_IOS ? Bell : BellRing
	return (
		<View
			style={[
				styles.permissionCard,
				{ backgroundColor: IS_IOS ? colors.cell : colors.accentSubtle },
			]}
		>
			{IS_IOS ? (
				<View style={[styles.permissionIcon, { backgroundColor: colors.accentSubtle }]}>
					<Icon color={colors.tint} size={20} strokeWidth={2} />
				</View>
			) : (
				<Icon color={colors.tint} size={24} strokeWidth={2} />
			)}
			<Text style={[styles.permissionText, { color: colors.label }]}>{PERMISSION_ASK}</Text>
			<Pressable
				accessibilityRole="button"
				onPress={onAllow}
				style={({ pressed }) => [
					styles.allowButton,
					{ backgroundColor: colors.tintFill, opacity: pressed ? 0.8 : 1 },
				]}
			>
				<Text style={[styles.allowLabel, { color: colors.onTint }]}>Allow</Text>
			</Pressable>
		</View>
	)
}

function AllowedRow() {
	const { colors } = useMobileColors()
	const subtitle = IS_IOS
		? "Change it in iOS Settings → Cortex → Notifications"
		: `Channels: ${listNotificationChannels()
				.map((channel) => channel.label)
				.join(", ")}`
	return (
		<View style={styles.allowedList}>
			<GroupedList>
				<GroupedRow
					chevron
					leading={
						IS_IOS ? (
							<View style={[styles.permissionIcon, { backgroundColor: colors.accentSubtle }]}>
								<Bell color={colors.tint} size={20} strokeWidth={2} />
							</View>
						) : (
							<BellRing color={colors.tint} size={24} strokeWidth={2} />
						)
					}
					onPress={() => void openSystemNotificationSettings()}
					subtitle={subtitle}
					title="Allowed"
				/>
			</GroupedList>
		</View>
	)
}

function SegmentedCard<T extends string>({
	accessibilityLabel,
	onChange,
	options,
	value,
}: {
	accessibilityLabel: string
	onChange: (value: T) => void
	options: { label: string; value: T }[]
	value: T
}) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.segmentedCard, { backgroundColor: colors.cell }]}>
			<SegmentedControl
				accessibilityLabel={accessibilityLabel}
				onChange={onChange}
				options={options}
				value={value}
			/>
		</View>
	)
}

export function NotificationsSettingsScreen() {
	const { colors } = useMobileColors()
	const tasks = useSettingsStore((state) => state.settings.tasks)
	const permission = useNotificationPermission()
	const [askVisible, setAskVisible] = useState(false)
	const [tested, setTested] = useState(false)
	const exactAlarms = getExactAlarmsState()

	useEffect(() => {
		void loadNotificationPermission()
	}, [])

	const quietLabel = tasks.quietHoursEnabled
		? `${tasks.quietHoursStart} – ${tasks.quietHoursEnd} · reminders wait until morning`
		: "Off"

	const handleContinue = () => {
		setAskVisible(false)
		void requestNotificationPermission()
	}

	const handleTest = () => {
		void sendTestReminder().then((sent) => setTested(sent))
	}

	return (
		<>
			<Stack.Screen options={{ title: "Notifications" }} />
			<ScrollView
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.groupedBackground }}
			>
				<GroupedFooter>{INTRO}</GroupedFooter>
				{permission === "granted" ? (
					<AllowedRow />
				) : (
					<PermissionCard onAllow={() => setAskVisible(true)} />
				)}

				<Host matchContents style={styles.host}>
					<FieldGroup>
						<FieldGroup.Section title="Reminders">
							<SettingsRow
								onToggle={(value) => updateTaskSetting("remindersEnabled", value)}
								subtitle="For tasks with a date and a reminder"
								title="Task reminders"
								toggled={tasks.remindersEnabled}
							/>
							<SettingsRow subtitle="Used when a task has a time" title="Default reminder" />
						</FieldGroup.Section>
					</FieldGroup>
				</Host>
				<SegmentedCard
					accessibilityLabel="Default reminder"
					onChange={(value) => updateTaskSetting("defaultReminder", value)}
					options={defaultReminderOptions}
					value={tasks.defaultReminder}
				/>
				<Host matchContents style={styles.host}>
					<FieldGroup>
						<FieldGroup.Section>
							<SettingsRow
								subtitle={
									IS_IOS
										? "Remind on the due day at"
										: `Remind on the due day at ${tasks.untimedReminderTime}`
								}
								title="Tasks without a time"
								trailing={
									IS_IOS ? (
										<Badge label={tasks.untimedReminderTime} />
									) : (
										<Clock color={colors.secondaryLabel} size={24} strokeWidth={2} />
									)
								}
							/>
							{!IS_IOS ? (
								<SettingsRow subtitle={exactAlarms.subtitle} title="Exact alarms" />
							) : null}
						</FieldGroup.Section>
						<FieldGroup.Section title="Summary">
							<SettingsRow
								onToggle={(value) => updateTaskSetting("digestEnabled", value)}
								subtitle="One summary of today and overdue tasks"
								title="Daily digest"
								toggled={tasks.digestEnabled}
							/>
							{tasks.digestEnabled ? <SettingsRow title="Digest time" /> : null}
						</FieldGroup.Section>
					</FieldGroup>
				</Host>
				{tasks.digestEnabled ? (
					<SegmentedCard
						accessibilityLabel="Digest time"
						onChange={(value) => updateTaskSetting("digestTime", value)}
						options={digestTimeOptions}
						value={tasks.digestTime}
					/>
				) : null}
				<Host matchContents style={styles.host}>
					<FieldGroup>
						<FieldGroup.Section title="Collaboration and sound">
							<SettingsRow
								onToggle={(value) => updateTaskSetting("mentionsEnabled", value)}
								subtitle="When someone @mentions you or replies in a thread"
								title="Mentions and comments"
								toggled={tasks.mentionsEnabled}
							/>
							<SettingsRow
								onToggle={(value) => updateTaskSetting("quietHoursEnabled", value)}
								subtitle={quietLabel}
								title="Quiet hours"
								toggled={tasks.quietHoursEnabled}
							/>
							<SettingsRow
								onToggle={(value) => updateTaskSetting("sound", value)}
								subtitle={SOUND_SUBTITLE}
								title="Play a sound"
								toggled={tasks.sound}
							/>
						</FieldGroup.Section>
					</FieldGroup>
				</Host>

				<Pressable
					accessibilityRole="button"
					onPress={handleTest}
					style={({ pressed }) => [
						styles.testButton,
						{ backgroundColor: IS_IOS ? colors.fill : colors.accentSubtle, opacity: pressed ? 0.7 : 1 },
					]}
				>
					<Text style={[styles.testLabel, { color: colors.tint }]}>Send a test reminder</Text>
				</Pressable>
				{tested ? (
					<Text style={[styles.sentText, { color: colors.successText }]}>{TEST_SENT}</Text>
				) : null}
				<GroupedFooter>{FOOTER}</GroupedFooter>
			</ScrollView>
			<NotificationPermissionPrompt
				onContinue={handleContinue}
				onDismiss={() => setAskVisible(false)}
				visible={askVisible}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	allowButton: {
		alignItems: "center",
		borderRadius: 999,
		height: IS_IOS ? 34 : 40,
		justifyContent: "center",
		paddingHorizontal: 16,
	},
	allowLabel: {
		fontSize: IS_IOS ? 15 : 14,
		fontWeight: IS_IOS ? "600" : "500",
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: 20,
	},
	allowedList: {
		marginTop: 12,
	},
	content: {
		paddingBottom: 40,
		paddingTop: 4,
	},
	host: {
		marginHorizontal: IS_IOS ? 0 : 12,
	},
	permissionCard: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		flexDirection: "row",
		gap: 12,
		marginHorizontal: 16,
		marginTop: 12,
		padding: IS_IOS ? 14 : 16,
		paddingLeft: 16,
	},
	permissionIcon: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 8,
		height: 30,
		justifyContent: "center",
		width: 30,
	},
	permissionText: {
		flex: 1,
		fontSize: IS_IOS ? 15 : 14,
		letterSpacing: IS_IOS ? 0 : 0.25,
		lineHeight: 20,
	},
	segmentedCard: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		marginHorizontal: 16,
		marginTop: 2,
		padding: 12,
	},
	sentText: {
		fontSize: IS_IOS ? 13 : 12,
		lineHeight: IS_IOS ? 18 : 16,
		marginHorizontal: IS_IOS ? 36 : 32,
		marginTop: 8,
	},
	testButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 50,
		justifyContent: "center",
		marginHorizontal: 16,
		marginTop: 18,
	},
	testLabel: {
		fontSize: IS_IOS ? 17 : 14,
		fontWeight: IS_IOS ? "600" : "500",
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: IS_IOS ? 22 : 20,
	},
})
