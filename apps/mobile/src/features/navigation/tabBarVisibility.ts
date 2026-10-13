import { useFocusEffect } from "expo-router"
import { useCallback, useSyncExternalStore } from "react"

const listeners = new Set<() => void>()
let hiddenCount = 0

function notify(): void {
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getHidden(): boolean {
	return hiddenCount > 0
}

export function useTabBarHidden(): boolean {
	return useSyncExternalStore(subscribe, getHidden, getHidden)
}

export function useHideTabBar(): void {
	useFocusEffect(
		useCallback(() => {
			hiddenCount++
			notify()
			return () => {
				hiddenCount--
				notify()
			}
		}, []),
	)
}
