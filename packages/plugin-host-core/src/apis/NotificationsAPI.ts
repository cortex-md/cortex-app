import type {
	PluginAPI,
	PluginNotification,
	PluginNotificationPermissionState,
	PluginNotificationResult,
} from "@cortex.md/api"
import { pluginHasCapability } from "../manifestCapabilities"

interface PluginNotificationPayload extends PluginNotification {
	pluginId: string
}

interface NotificationFunctions {
	isSupported: () => boolean
	getPermission: () => Promise<PluginNotificationPermissionState>
	send: (notification: PluginNotificationPayload) => Promise<PluginNotificationResult>
}

const RATE_LIMIT_WINDOW_MS = 30_000
const RATE_LIMIT_MAX_NOTIFICATIONS = 3

let notificationFns: NotificationFunctions | null = null
const notificationTimestamps = new Map<string, number[]>()

export function setNotificationFunctions(fns: NotificationFunctions): void {
	notificationFns = fns
}

export function createNotificationsAPI(pluginId: string): PluginAPI["notifications"] {
	return {
		isSupported(): boolean {
			if (!pluginHasCapability(pluginId, "notifications")) return false
			return notificationFns?.isSupported() ?? false
		},

		async getPermission(): Promise<PluginNotificationPermissionState> {
			if (!pluginHasCapability(pluginId, "notifications")) return "unsupported"
			return notificationFns?.getPermission() ?? "unsupported"
		},

		async send(notification: PluginNotification): Promise<PluginNotificationResult> {
			if (!pluginHasCapability(pluginId, "notifications")) {
				return { delivered: false, reason: "missing-capability" }
			}

			if (!notificationFns?.isSupported()) {
				return { delivered: false, reason: "unsupported" }
			}

			if (!isValidNotification(notification)) {
				return { delivered: false, reason: "invalid" }
			}

			if (isRateLimited(pluginId)) {
				return { delivered: false, reason: "rate-limited" }
			}

			const permission = await notificationFns.getPermission()
			if (permission !== "granted") {
				return { delivered: false, reason: "permission-denied" }
			}

			return notificationFns.send({ ...notification, pluginId })
		},
	}
}

function isValidNotification(notification: PluginNotification): boolean {
	return notification.title.trim().length > 0
}

function isRateLimited(pluginId: string): boolean {
	const now = Date.now()
	const recentTimestamps = (notificationTimestamps.get(pluginId) ?? []).filter(
		(timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
	)

	if (recentTimestamps.length >= RATE_LIMIT_MAX_NOTIFICATIONS) {
		notificationTimestamps.set(pluginId, recentTimestamps)
		return true
	}

	recentTimestamps.push(now)
	notificationTimestamps.set(pluginId, recentTimestamps)
	return false
}

export function resetNotificationRateLimits(): void {
	notificationTimestamps.clear()
}
