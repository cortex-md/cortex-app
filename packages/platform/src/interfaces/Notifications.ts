export type NativeNotificationPermissionState = "granted" | "denied" | "prompt" | "unsupported"

export type NativeNotificationKind = "info" | "success" | "warning" | "error"

export type NativeNotificationUrgency = "low" | "normal" | "high"

export type NativeNotificationSource = "core" | "plugin"

export type NativeNotificationIcon =
	| { type: "app" }
	| { type: "lucide"; name: string }
	| { type: "asset"; path: string }

export type NativeNotificationSound =
	| { type: "default" }
	| { type: "system"; name: string }
	| { type: "asset"; path: string }

export interface NativeNotificationCapabilities {
	supported: boolean
	icons: boolean
	sounds: boolean
	actions: boolean
}

export interface NativeNotificationRequest {
	id?: string
	title: string
	body?: string
	kind?: NativeNotificationKind
	icon?: NativeNotificationIcon
	sound?: NativeNotificationSound
	tag?: string
	silent?: boolean
	urgency?: NativeNotificationUrgency
	source: NativeNotificationSource
	pluginId?: string
	metadata?: Record<string, string | number | boolean | null>
}

export type NativeNotificationFailureReason =
	| "unsupported"
	| "permission-denied"
	| "invalid"
	| "failed"

export interface NativeNotificationResult {
	delivered: boolean
	reason?: NativeNotificationFailureReason
}

export interface Notifications {
	getCapabilities(): NativeNotificationCapabilities
	getPermission(): Promise<NativeNotificationPermissionState>
	requestPermission(): Promise<NativeNotificationPermissionState>
	send(notification: NativeNotificationRequest): Promise<NativeNotificationResult>
}
