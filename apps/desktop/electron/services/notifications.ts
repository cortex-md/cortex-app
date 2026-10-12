import type {
	NativeNotificationPermissionState,
	NativeNotificationRequest,
	NotificationActivation,
	NotificationPayload,
} from "@cortex/platform"
import { Notification, shell } from "electron"
import type { MainApi } from "../contract"
import { emitToVaultWindow, openVaultWindow } from "../windows"
import {
	markNotificationDelivered,
	markNotificationDeliveryFailed,
	reminderPermission,
	scheduleReminders,
} from "./reminderScheduler"

const SYSTEM_NOTIFICATION_SETTINGS: Partial<Record<NodeJS.Platform, string>> = {
	darwin: "x-apple.systempreferences:com.apple.Notifications-Settings.extension",
	win32: "ms-settings:notifications",
}

const permission = async (): Promise<NativeNotificationPermissionState> => reminderPermission()

const activeNotifications = new Map<string, Notification>()
let notificationSequence = 0

function activationPayload(notification: NativeNotificationRequest): NotificationPayload {
	return { ...(notification.metadata ?? {}) }
}

function wireActivation(
	nativeNotification: Notification,
	notification: NativeNotificationRequest,
	notificationId: string,
): void {
	const scope = notification.activationScope
	if (!scope) return
	const activate = (actionId: string | null, reply?: string) => {
		const activation: NotificationActivation = {
			scope,
			notificationId,
			actionId,
			payload: activationPayload(notification),
			...(reply === undefined ? {} : { reply }),
		}
		if (actionId === null) openVaultWindow(scope)
		emitToVaultWindow(scope, "notification-activation", activation)
	}
	nativeNotification.on("click", () => activate(null))
	nativeNotification.on("reply", (_event, reply) => activate("reply", reply))
}

export const notificationsApi = {
	getPermission: permission,
	requestPermission: permission,
	send: async (notification) => {
		if (!notification.title.trim()) return { delivered: false, reason: "invalid" }
		if (!Notification.isSupported()) return { delivered: false, reason: "unsupported" }
		try {
			notificationSequence += 1
			const notificationId = notification.id ?? `notification-${notificationSequence}`
			const canReply = process.platform === "darwin" && Boolean(notification.reply)
			const nativeNotification = new Notification({
				title: notification.title,
				body: notification.body,
				silent: notification.silent ?? false,
				...(canReply ? { hasReply: true, replyPlaceholder: notification.reply?.placeholder } : {}),
			})
			nativeNotification.on("show", markNotificationDelivered)
			nativeNotification.on("failed", markNotificationDeliveryFailed)
			wireActivation(nativeNotification, notification, notificationId)
			nativeNotification.on("close", () => activeNotifications.delete(notificationId))
			activeNotifications.get(notificationId)?.close()
			activeNotifications.set(notificationId, nativeNotification)
			nativeNotification.show()
			return { delivered: true }
		} catch {
			return { delivered: false, reason: "failed" }
		}
	},
	schedule: async (scope, notifications) => {
		if (typeof scope !== "string" || !scope) return
		scheduleReminders(scope, notifications)
	},
	openSystemSettings: async () => {
		const target = SYSTEM_NOTIFICATION_SETTINGS[process.platform]
		if (target) await shell.openExternal(target)
	},
} satisfies MainApi["notifications"]
