import { showToast, type ToastAction } from "@/features/feedback/toastStore"

export function toast(message: string, action?: ToastAction): void {
	showToast(message, { action })
}

export function toastWithUndo(message: string, undo: () => void): void {
	showToast(message, { action: { label: "Undo", onPress: undo } })
}
