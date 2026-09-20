import type {
	NativeNotificationCapabilities,
	NativeNotificationPermissionState,
	NativeNotificationRequest,
	NativeNotificationResult,
	Notifications as NotificationsInterface,
} from "@cortex/platform"
import { invoke } from "./bridge"

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
		return await invoke<NativeNotificationPermissionState>("notifications_get_permission")
	}

	async requestPermission(): Promise<NativeNotificationPermissionState> {
		return await invoke<NativeNotificationPermissionState>("notifications_request_permission")
	}

	async send(notification: NativeNotificationRequest): Promise<NativeNotificationResult> {
		if (!notification.title.trim()) {
			return { delivered: false, reason: "invalid" }
		}
		return await invoke<NativeNotificationResult>("notifications_send", { notification })
	}
}
