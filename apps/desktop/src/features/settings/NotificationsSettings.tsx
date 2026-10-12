import { getPlatform, type NativeNotificationPermissionState } from "@cortex/platform"
import type { TasksSettings } from "@cortex/settings"
import { Button, Switch, Tabs, TabsList, TabsTrigger } from "@cortex/ui"
import { BellIcon, CheckIcon, TriangleAlertIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { TimeField } from "../tasks/TimeField"
import type { UpdateSettingFn } from "."
import { SettingsField, SettingsGroup, SettingsPage, SettingsSection } from "./SettingsPrimitives"

interface NotificationsSectionProps {
	settings: TasksSettings
	onUpdate: UpdateSettingFn
}

interface SegmentOption {
	value: string
	label: string
}

const DEFAULT_REMINDER_OPTIONS: readonly SegmentOption[] = [
	{ value: "at", label: "At time" },
	{ value: "5", label: "5 min" },
	{ value: "15", label: "15 min" },
	{ value: "60", label: "1 hour" },
]

const DIGEST_TIME_PRESETS = ["07:30", "08:30", "09:00"]

const PERMISSION_TEXT: Record<NativeNotificationPermissionState, string> = {
	granted: "Allowed in System Settings → Notifications.",
	prompt: "Cortex needs permission to show notifications on this device.",
	denied: "Notifications are blocked. Allow Cortex in System Settings → Notifications.",
	unsupported: "This device does not support system notifications.",
}

function SegmentedSetting({
	label,
	value,
	options,
	onChange,
}: {
	label: string
	value: string
	options: readonly SegmentOption[]
	onChange: (value: string) => void
}) {
	return (
		<Tabs value={value} onValueChange={onChange} className="settings-segmented">
			<TabsList aria-label={label}>
				{options.map((option) => (
					<TabsTrigger key={option.value} value={option.value}>
						{option.label}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	)
}

function NotificationPermissionNotice({
	permission,
	onAllow,
}: {
	permission: NativeNotificationPermissionState
	onAllow: () => void
}) {
	const allowed = permission === "granted"
	const Icon = allowed ? CheckIcon : TriangleAlertIcon
	return (
		<div className="task-permission" data-state={allowed ? "granted" : "attention"}>
			<Icon className="size-4 shrink-0" aria-hidden="true" />
			<p>{PERMISSION_TEXT[permission]}</p>
			{(permission === "prompt" || permission === "denied") && (
				<Button size="xs" onClick={onAllow}>
					Allow
				</Button>
			)}
		</div>
	)
}

export function NotificationsSection({ settings, onUpdate }: NotificationsSectionProps) {
	const [permission, setPermission] = useState<NativeNotificationPermissionState>("granted")

	useEffect(() => {
		let cancelled = false
		getPlatform()
			.notifications.getPermission()
			.then((state) => {
				if (!cancelled) setPermission(state)
			})
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [])

	const sendTestReminder = async () => {
		const notifications = getPlatform().notifications
		await notifications.send({
			title: "Test reminder",
			body: "Task reminders from Cortex will look like this.",
			silent: !settings.sound,
			source: "core",
		})
		setPermission(await notifications.getPermission())
	}

	const handleAllow = () => {
		if (permission === "denied") void getPlatform().notifications.openSystemSettings?.()
		else void sendTestReminder()
	}

	const update = (key: keyof TasksSettings) => (value: unknown) => onUpdate("tasks", key, value)
	const digestOptions = (
		DIGEST_TIME_PRESETS.includes(settings.digestTime)
			? DIGEST_TIME_PRESETS
			: [...DIGEST_TIME_PRESETS, settings.digestTime].sort()
	).map((time) => ({ value: time, label: time }))

	return (
		<SettingsPage>
			<SettingsSection title="Permission" fieldId="notifications.permission">
				<NotificationPermissionNotice permission={permission} onAllow={handleAllow} />
			</SettingsSection>

			<SettingsSection title="Reminders">
				<SettingsGroup>
					<SettingsField fieldId="notifications.task-reminders" htmlFor="task-reminders">
						<Switch
							id="task-reminders"
							checked={settings.remindersEnabled}
							onCheckedChange={update("remindersEnabled")}
						/>
					</SettingsField>
					<SettingsField
						fieldId="notifications.default-reminder"
						controlClassName="task-setting-control"
					>
						<SegmentedSetting
							label="Default reminder"
							value={settings.defaultReminder}
							options={DEFAULT_REMINDER_OPTIONS}
							onChange={update("defaultReminder")}
						/>
					</SettingsField>
					<SettingsField fieldId="notifications.untimed-reminder" htmlFor="untimed-reminder">
						<TimeField
							id="untimed-reminder"
							value={settings.untimedReminderTime}
							onChange={update("untimedReminderTime")}
						/>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>

			<SettingsSection title="Daily digest">
				<SettingsGroup>
					<SettingsField fieldId="notifications.digest" htmlFor="daily-digest">
						<Switch
							id="daily-digest"
							checked={settings.digestEnabled}
							onCheckedChange={update("digestEnabled")}
						/>
					</SettingsField>
					{settings.digestEnabled && (
						<SettingsField label="Digest time" controlClassName="task-setting-control">
							<SegmentedSetting
								label="Digest time"
								value={settings.digestTime}
								options={digestOptions}
								onChange={update("digestTime")}
							/>
						</SettingsField>
					)}
				</SettingsGroup>
			</SettingsSection>

			<SettingsSection title="Mentions and comments">
				<SettingsGroup>
					<SettingsField fieldId="notifications.mentions" htmlFor="mention-notifications">
						<Switch
							id="mention-notifications"
							checked={settings.mentionsEnabled}
							onCheckedChange={update("mentionsEnabled")}
						/>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>

			<SettingsSection title="Delivery">
				<SettingsGroup>
					<SettingsField
						fieldId="notifications.quiet-hours"
						htmlFor="quiet-hours"
						description={
							settings.quietHoursEnabled
								? `${settings.quietHoursStart} – ${settings.quietHoursEnd} · reminders wait until morning`
								: "Off"
						}
					>
						<Switch
							id="quiet-hours"
							checked={settings.quietHoursEnabled}
							onCheckedChange={update("quietHoursEnabled")}
						/>
					</SettingsField>
					{settings.quietHoursEnabled && (
						<SettingsField label="Quiet hours window">
							<span className="task-time-range">
								<TimeField
									ariaLabel="Quiet hours start"
									value={settings.quietHoursStart}
									onChange={update("quietHoursStart")}
								/>
								<span aria-hidden="true">–</span>
								<TimeField
									ariaLabel="Quiet hours end"
									value={settings.quietHoursEnd}
									onChange={update("quietHoursEnd")}
								/>
							</span>
						</SettingsField>
					)}
					<SettingsField fieldId="notifications.sound" htmlFor="notification-sound">
						<Switch
							id="notification-sound"
							checked={settings.sound}
							onCheckedChange={update("sound")}
						/>
					</SettingsField>
				</SettingsGroup>
				<div className="task-test-reminder">
					<Button variant="secondary" size="sm" onClick={() => void sendTestReminder()}>
						<BellIcon />
						Send a test reminder
					</Button>
					<span>
						Reminders fire on the device that is awake; other devices clear it when one handles it.
					</span>
				</div>
			</SettingsSection>
		</SettingsPage>
	)
}
