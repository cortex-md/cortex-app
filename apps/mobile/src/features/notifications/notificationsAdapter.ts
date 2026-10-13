import { getPlatform } from "@cortex/platform"
import { useSyncExternalStore } from "react"
import { Linking } from "react-native"

import {
	exactAlarmsFixture,
	type NotificationChannel,
	notificationChannels,
	type NotificationPermissionState,
	testReminderFixture,
} from "@/features/notifications/notificationsFixtures"

const listeners = new Set<() => void>()
let permission: NotificationPermissionState = "prompt"

function notify(): void {
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getPermission(): NotificationPermissionState {
	return permission
}

function setPermission(next: NotificationPermissionState): void {
	if (permission === next) return
	permission = next
	notify()
}

export async function loadNotificationPermission(): Promise<NotificationPermissionState> {
	// stub: the Expo platform adapter reports "unsupported" until expo-notifications is wired
	const state = await getPlatform().notifications.getPermission()
	if (state === "granted" || state === "denied") setPermission(state)
	return permission
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
	// stub: replace with expo-notifications requestPermissionsAsync once native builds exist
	const state = await getPlatform().notifications.requestPermission()
	setPermission(state === "denied" ? "denied" : "granted")
	return permission
}

export async function sendTestReminder(): Promise<boolean> {
	// stub: the real path schedules testReminderFixture through getPlatform().notifications.send
	const result = await getPlatform().notifications.send({
		title: testReminderFixture.title,
		body: testReminderFixture.body,
		source: "core",
	})
	return result.delivered || permission === "granted"
}

export async function openSystemNotificationSettings(): Promise<void> {
	// stub: iOS deep links to Settings → Cortex → Notifications; Android to the channel list
	const platformSettings = getPlatform().notifications.openSystemSettings
	if (platformSettings) {
		await platformSettings()
		return
	}
	await Linking.openSettings()
}

export function listNotificationChannels(): NotificationChannel[] {
	// stub: Android channels come from the notification module once it exists
	return notificationChannels
}

export function getExactAlarmsState(): { allowed: boolean; subtitle: string } {
	// stub: read AlarmManager.canScheduleExactAlarms through a native module
	return exactAlarmsFixture
}

export function useNotificationPermission(): NotificationPermissionState {
	return useSyncExternalStore(subscribe, getPermission, getPermission)
}
