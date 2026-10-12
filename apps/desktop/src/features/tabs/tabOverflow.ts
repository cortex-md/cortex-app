interface OverflowTab {
	id: string
	lastAccessed?: number
}

export function getVisibleTabIds(
	tabs: readonly OverflowTab[],
	activeTabId: string | null,
	capacity: number,
): Set<string> {
	if (tabs.length <= capacity) return new Set(tabs.map((tab) => tab.id))
	const ranked = [...tabs].sort((a, b) => {
		if (a.id === activeTabId) return -1
		if (b.id === activeTabId) return 1
		return (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0)
	})
	return new Set(ranked.slice(0, Math.max(1, capacity)).map((tab) => tab.id))
}
