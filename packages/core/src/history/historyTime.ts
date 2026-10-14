const DAY_MS = 86_400_000

export function historyDayLabel(timestamp: number | null, now = Date.now()): string {
	if (timestamp === null) return "Earlier"
	const today = new Date(now)
	today.setHours(0, 0, 0, 0)
	if (timestamp >= today.getTime()) return "Today"
	if (timestamp >= today.getTime() - DAY_MS) return "Yesterday"
	return "Earlier"
}

export function groupByDay<T>(
	items: readonly T[],
	getTimestamp: (item: T) => number | null,
): { label: string; items: T[] }[] {
	const groups: { label: string; items: T[] }[] = []
	const now = Date.now()
	for (const item of items) {
		const label = historyDayLabel(getTimestamp(item), now)
		const last = groups.at(-1)
		if (last?.label === label) last.items.push(item)
		else groups.push({ label, items: [item] })
	}
	return groups
}

export function parseTimestamp(value: string | null | undefined): number | null {
	if (!value) return null
	const time = Date.parse(value)
	return Number.isNaN(time) ? null : time
}
