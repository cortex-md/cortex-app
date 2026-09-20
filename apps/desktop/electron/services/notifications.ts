import { Notification } from "electron"

export type NativeNotificationPermissionState = "granted" | "denied" | "prompt" | "unsupported"

export interface NativeNotificationRequest {
	id?: string
	title: string
	body?: string
	kind?: "info" | "success" | "warning" | "error"
	silent?: boolean
	urgency?: "low" | "normal" | "high"
	source: "core" | "plugin"
	pluginId?: string
}

export interface NativeNotificationResult {
	delivered: boolean
	reason?: "unsupported" | "permission-denied" | "invalid" | "failed"
}

export async function getPermission(): Promise<NativeNotificationPermissionState> {
	if (!Notification.isSupported()) return "unsupported"
	return "granted"
}

export async function requestPermission(): Promise<NativeNotificationPermissionState> {
	if (!Notification.isSupported()) return "unsupported"
	return "granted"
}

export async function send(
	notification: NativeNotificationRequest,
): Promise<NativeNotificationResult> {
	if (!notification.title.trim()) {
		return { delivered: false, reason: "invalid" }
	}
	if (!Notification.isSupported()) {
		return { delivered: false, reason: "unsupported" }
	}
	try {
		const native = new Notification({
			title: notification.title,
			body: notification.body,
			silent: notification.silent ?? false,
		})
		native.show()
		return { delivered: true }
	} catch {
		return { delivered: false, reason: "failed" }
	}
}
