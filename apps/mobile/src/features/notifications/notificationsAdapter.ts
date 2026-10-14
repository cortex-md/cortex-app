import { getPlatform } from "@cortex/platform"
import { useSyncExternalStore } from "react"
import { Linking } from "react-native"

import {
	type NotificationChannel,
	type NotificationPermissionState,
	REMINDER_CHANNEL,
	TEST_REMINDER,
} from "@/features/notifications/notificationTypes"

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
	const state = await getPlatform().notifications.getPermission()
	if (state === "granted" || state === "denied") setPermission(state)
	return permission
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
	const state = await getPlatform().notifications.requestPermission()
	setPermission(state === "granted" || state === "denied" ? state : "prompt")
	return permission
}

export async function sendTestReminder(): Promise<boolean> {
	const result = await getPlatform().notifications.send({
		title: TEST_REMINDER.title,
		body: TEST_REMINDER.body,
		source: "core",
	})
	return result.delivered
}

export async function openSystemNotificationSettings(): Promise<void> {
	const platformSettings = getPlatform().notifications.openSystemSettings
	if (platformSettings) {
		await platformSettings()
		return
	}
	await Linking.openSettings()
}

export function listNotificationChannels(): NotificationChannel[] {
	return [REMINDER_CHANNEL]
}

export function getExactAlarmsState(): { allowed: boolean; subtitle: string } {
	return { allowed: true, subtitle: "Android decides exact timing in system settings" }
}

export function useNotificationPermission(): NotificationPermissionState {
	return useSyncExternalStore(subscribe, getPermission, getPermission)
}
