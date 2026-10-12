import { getThemeManager, type Theme } from "@cortex/theme"
import { useSyncExternalStore } from "react"

function subscribeActiveTheme(listener: () => void): () => void {
	return getThemeManager().subscribe(listener)
}

function getActiveTheme(): Theme {
	return getThemeManager().getActiveTheme()
}

export function useActiveTheme(): Theme {
	return useSyncExternalStore(subscribeActiveTheme, getActiveTheme, getActiveTheme)
}
