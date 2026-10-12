import { useSyncExternalStore } from "react"

export interface ModalStore<T> {
	open: (target: T) => void
	close: () => void
	getTarget: () => T | null
	useTarget: () => T | null
}

export function createModalStore<T>(): ModalStore<T> {
	const listeners = new Set<() => void>()
	let target: T | null = null

	const emit = () => {
		for (const listener of listeners) listener()
	}
	const subscribe = (listener: () => void) => {
		listeners.add(listener)
		return () => {
			listeners.delete(listener)
		}
	}
	const getTarget = () => target

	return {
		open: (nextTarget) => {
			target = nextTarget
			emit()
		},
		close: () => {
			if (target === null) return
			target = null
			emit()
		},
		getTarget,
		useTarget: () => useSyncExternalStore(subscribe, getTarget, getTarget),
	}
}
