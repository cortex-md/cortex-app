import { getPlatform, type NativeNotificationRequest } from "@cortex/platform"

type CoreNotification = Omit<NativeNotificationRequest, "source">

export async function sendCoreNotification(notification: CoreNotification): Promise<boolean> {
	const platform = getPlatform()
	if (!platform.capabilities.includes("notifications")) return false

	const result = await platform.notifications.send({
		...notification,
		source: "core",
	})
	return result.delivered
}
