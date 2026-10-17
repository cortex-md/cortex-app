import { useSyncExternalStore } from "react"

export interface ToastAction {
	label: string
	onPress: () => void
}

export interface Toast {
	id: number
	message: string
	action?: ToastAction
	duration: number
}

const listeners = new Set<() => void>()
let current: Toast | null = null
let nextId = 0
let timer: ReturnType<typeof setTimeout> | null = null

function notify(): void {
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getToast(): Toast | null {
	return current
}

export function dismissToast(id?: number): void {
	if (id !== undefined && current?.id !== id) return
	if (timer) clearTimeout(timer)
	timer = null
	current = null
	notify()
}

export function showToast(
	message: string,
	options: { action?: ToastAction; duration?: number } = {},
) {
	const toast: Toast = {
		action: options.action,
		duration: options.duration ?? (options.action ? 5000 : 3000),
		id: ++nextId,
		message,
	}
	if (timer) clearTimeout(timer)
	current = toast
	notify()
	timer = setTimeout(() => dismissToast(toast.id), toast.duration)
	return toast.id
}

export function useToastState(): Toast | null {
	return useSyncExternalStore(subscribe, getToast, getToast)
}
