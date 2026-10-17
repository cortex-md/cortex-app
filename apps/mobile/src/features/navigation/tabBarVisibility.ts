import { useFocusEffect } from "expo-router"
import { useSyncExternalStore } from "react"

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

function releaseTabBar(): void {
	hiddenCount -= 1
	notify()
}

function hideTabBar(): () => void {
	hiddenCount += 1
	notify()
	return releaseTabBar
}

export function useHideTabBar(): void {
	useFocusEffect(hideTabBar)
}
