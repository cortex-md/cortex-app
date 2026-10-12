import * as Haptics from "expo-haptics"

export function triggerSelectionHaptic(): void {
	void Haptics.selectionAsync().catch(() => {})
}

export function triggerDeleteHaptic(): void {
	void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
}
