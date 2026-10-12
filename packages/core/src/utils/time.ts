import type { FileEntry } from "@cortex/platform"

export type RelativeTimeStyle = "short" | "long"

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

function isSameCalendarDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	)
}

export function formatRelativeTime(
	timestamp: number | null | undefined,
	style: RelativeTimeStyle = "long",
	now: number = Date.now(),
): string {
	if (!timestamp || !Number.isFinite(timestamp)) return ""
	const elapsed = Math.max(0, now - timestamp)
	if (elapsed < MINUTE_MS) return style === "short" ? "now" : "just now"
	if (elapsed < HOUR_MS) {
		const minutes = Math.floor(elapsed / MINUTE_MS)
		return style === "short" ? `${minutes}m` : `${minutes} min ago`
	}
	const date = new Date(timestamp)
	const today = new Date(now)
	if (elapsed < DAY_MS && isSameCalendarDay(date, today)) {
		const hours = Math.floor(elapsed / HOUR_MS)
		return style === "short" ? `${hours}h` : `${hours} ${hours === 1 ? "hour" : "hours"} ago`
	}
	const yesterday = new Date(now - DAY_MS)
	if (isSameCalendarDay(date, yesterday)) return style === "short" ? "1d" : "yesterday"
	const sameYear = date.getFullYear() === today.getFullYear()
	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: sameYear ? undefined : "numeric",
	})
}

export function fileEntryMtimeToMs(mtime: number | undefined): number | null {
	if (!mtime) return null
	return mtime < 100_000_000_000 ? mtime * 1000 : mtime
}

const modifiedTimesCache = new WeakMap<readonly FileEntry[], Map<string, number>>()

export function getFileModifiedTimes(files: readonly FileEntry[]): ReadonlyMap<string, number> {
	const cached = modifiedTimesCache.get(files)
	if (cached) return cached
	const times = new Map<string, number>()
	for (const file of files) {
		const modifiedAt = file.isDir ? null : fileEntryMtimeToMs(file.mtime)
		if (modifiedAt) times.set(file.path, modifiedAt)
	}
	modifiedTimesCache.set(files, times)
	return times
}
