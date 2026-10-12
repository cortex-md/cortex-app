export interface NavigationLocation {
	tabType: "file" | "view"
	filePath: string
	viewId: string | null
	viewState: Record<string, unknown> | null
	title: string
}

export interface NavigationHistory {
	entries: NavigationLocation[]
	index: number
}

export type NavigationDirection = -1 | 1

const NAVIGATION_HISTORY_LIMIT = 50

export const EMPTY_NAVIGATION_HISTORY: NavigationHistory = { entries: [], index: -1 }

export function isSameNavigationLocation(a: NavigationLocation, b: NavigationLocation): boolean {
	return a.tabType === b.tabType && a.filePath === b.filePath && a.viewId === b.viewId
}

export function pushNavigationLocation(
	history: NavigationHistory,
	location: NavigationLocation,
	limit = NAVIGATION_HISTORY_LIMIT,
): NavigationHistory {
	const current = history.entries[history.index]
	if (current && isSameNavigationLocation(current, location)) {
		const entries = history.entries.slice()
		entries[history.index] = location
		return { entries, index: history.index }
	}
	const entries = [...history.entries.slice(0, history.index + 1), location].slice(-limit)
	return { entries, index: entries.length - 1 }
}

export function canStepNavigationHistory(
	history: NavigationHistory | undefined,
	direction: NavigationDirection,
): boolean {
	if (!history) return false
	const nextIndex = history.index + direction
	return nextIndex >= 0 && nextIndex < history.entries.length
}

export function stepNavigationHistory(
	history: NavigationHistory,
	direction: NavigationDirection,
): { history: NavigationHistory; location: NavigationLocation } | null {
	if (!canStepNavigationHistory(history, direction)) return null
	const index = history.index + direction
	return { history: { entries: history.entries, index }, location: history.entries[index] }
}

export function renameNavigationLocations(
	history: NavigationHistory,
	rename: (filePath: string) => string | null,
): NavigationHistory {
	let changed = false
	const entries = history.entries.map((entry) => {
		const nextPath = entry.tabType === "file" ? rename(entry.filePath) : null
		if (!nextPath) return entry
		changed = true
		return { ...entry, filePath: nextPath }
	})
	return changed ? { entries, index: history.index } : history
}
