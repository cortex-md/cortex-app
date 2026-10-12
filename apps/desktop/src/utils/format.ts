const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	year: "numeric",
})

const monthFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	year: "numeric",
})

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
})

type DateInput = Date | string | number

function toValidDate(value: DateInput): Date | null {
	const date = value instanceof Date ? value : new Date(value)
	return Number.isNaN(date.getTime()) ? null : date
}

export function formatShortDate(value: DateInput): string {
	const date = toValidDate(value)
	return date ? shortDateFormatter.format(date) : String(value)
}

export function formatMonth(value: DateInput): string {
	const date = toValidDate(value)
	return date ? monthFormatter.format(date) : String(value)
}

export function formatDateTime(value: DateInput): string {
	const date = toValidDate(value)
	return date ? dateTimeFormatter.format(date) : String(value)
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
	const elapsed = now - timestamp
	if (elapsed < MINUTE_MS) return "Just now"
	if (elapsed < HOUR_MS)
		return relativeTimeFormatter.format(-Math.round(elapsed / MINUTE_MS), "minute")
	if (elapsed < DAY_MS) return relativeTimeFormatter.format(-Math.round(elapsed / HOUR_MS), "hour")
	if (elapsed < 7 * DAY_MS)
		return relativeTimeFormatter.format(-Math.round(elapsed / DAY_MS), "day")
	return formatShortDate(timestamp)
}

export function getInitials(name: string, fallback = "?"): string {
	const words = name.trim().split(/\s+/).filter(Boolean)
	if (words.length === 0) return fallback
	return words
		.slice(0, 2)
		.map((word) => word.charAt(0).toLocaleUpperCase())
		.join("")
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
	return count === 1 ? singular : plural
}

export function formatCount(count: number, singular: string, plural?: string): string {
	return `${count} ${pluralize(count, singular, plural)}`
}

export function toggleSetItem<T>(set: ReadonlySet<T>, item: T): Set<T> {
	const next = new Set(set)
	if (next.has(item)) next.delete(item)
	else next.add(item)
	return next
}
