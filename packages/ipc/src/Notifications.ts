import type {
	NativeNotificationCapabilities,
	NativeNotificationPermissionState,
	NativeNotificationRequest,
	NativeNotificationResult,
	Notifications as NotificationsInterface,
} from "@cortex/platform"
import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
} from "@tauri-apps/plugin-notification"

export class Notifications implements NotificationsInterface {
	getCapabilities(): NativeNotificationCapabilities {
		return {
			supported: true,
			icons: false,
			sounds: true,
			actions: false,
		}
	}

	async getPermission(): Promise<NativeNotificationPermissionState> {
		try {
			if (await isPermissionGranted()) return "granted"
			return "prompt"
		} catch {
			return "unsupported"
		}
	}

	async requestPermission(): Promise<NativeNotificationPermissionState> {
		try {
			if (await isPermissionGranted()) return "granted"
			return normalizePermission(await requestPermission())
		} catch {
			return "unsupported"
		}
	}

	async send(notification: NativeNotificationRequest): Promise<NativeNotificationResult> {
		if (!notification.title.trim()) {
			return { delivered: false, reason: "invalid" }
		}

		let permission = await this.getPermission()
		if (permission === "prompt" && notification.source === "core") {
			permission = await this.requestPermission()
		}

		if (permission === "unsupported") {
			return { delivered: false, reason: "unsupported" }
		}

		if (permission !== "granted") {
			return { delivered: false, reason: "permission-denied" }
		}

		try {
			await sendNotification({
				id: notification.id ? hashNotificationId(notification.id) : undefined,
				title: notification.title,
				body: notification.body,
				group: notification.tag,
				silent: notification.silent,
				sound: getSoundName(notification),
				icon: getIconName(notification),
				extra: getExtra(notification),
			})
			return { delivered: true }
		} catch {
			return { delivered: false, reason: "failed" }
		}
	}
}

function normalizePermission(value: string): NativeNotificationPermissionState {
	if (value === "granted" || value === "denied" || value === "prompt") return value
	return "prompt"
}

function getSoundName(notification: NativeNotificationRequest): string | undefined {
	if (notification.silent) return undefined
	if (!notification.sound) return undefined
	if (notification.sound.type === "default") return "default"
	if (notification.sound.type === "system") return notification.sound.name
	return notification.sound.path
}

function getIconName(notification: NativeNotificationRequest): string | undefined {
	if (!notification.icon) return undefined
	if (notification.icon.type === "asset") return notification.icon.path
	return undefined
}

function getExtra(notification: NativeNotificationRequest): Record<string, unknown> {
	return {
		kind: notification.kind ?? "info",
		source: notification.source,
		pluginId: notification.pluginId,
		urgency: notification.urgency ?? "normal",
		metadata: notification.metadata ?? {},
	}
}

function hashNotificationId(value: string): number {
	let hash = 0
	for (let index = 0; index < value.length; index++) {
		hash = (hash * 31 + value.charCodeAt(index)) | 0
	}
	return Math.abs(hash)
}
