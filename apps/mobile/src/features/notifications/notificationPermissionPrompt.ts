import { Alert, Platform } from "react-native"

import { requestNotificationPermission } from "@/features/notifications/notificationsAdapter"

const PLATFORM_NAME = Platform.OS === "ios" ? "iOS" : "Android"
const PROMPT_TITLE = "Get reminded on time"
const PROMPT_BODY = `Cortex only notifies you for tasks with ⏰, the daily digest and, if you want, when someone mentions you. ${PLATFORM_NAME} asks you next.`

export function promptNotificationPermission(): void {
	Alert.alert(PROMPT_TITLE, PROMPT_BODY, [
		{ style: "cancel", text: "Not now" },
		{ onPress: () => void requestNotificationPermission(), text: "Continue" },
	])
}
