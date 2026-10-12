import { addDays, addMonths } from "./dates"
import type { IsoDate, RepeatUnit, TaskRepeat } from "./types"

const UNIT_ALIASES: Record<string, RepeatUnit> = {
	day: "day",
	days: "day",
	daily: "day",
	week: "week",
	weeks: "week",
	weekly: "week",
	month: "month",
	months: "month",
	monthly: "month",
	year: "year",
	years: "year",
	yearly: "year",
}

const REPEAT_PATTERN =
	/^every\s+(?:(\d+)\s+)?(day|days|week|weeks|month|months|year|years)(?:\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th)?)?$/i
const SHORT_REPEAT_PATTERN = /^(daily|weekly|monthly|yearly)$/i
const WHEN_DONE_PATTERN = /\s+when\s+done$/i
const MAX_CATCH_UP_STEPS = 100_000

function ordinal(value: number): string {
	const lastTwo = value % 100
	if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`
	const suffix = { 1: "st", 2: "nd", 3: "rd" }[value % 10] ?? "th"
	return `${value}${suffix}`
}

function parseRepeatRule(text: string): TaskRepeat | undefined {
	const shortMatch = SHORT_REPEAT_PATTERN.exec(text)
	if (shortMatch?.[1]) {
		const unit = UNIT_ALIASES[shortMatch[1].toLowerCase()]
		return unit ? { unit, interval: 1 } : undefined
	}
	const match = REPEAT_PATTERN.exec(text)
	if (!match?.[2]) return undefined
	const unit = UNIT_ALIASES[match[2].toLowerCase()]
	if (!unit) return undefined
	const interval = Math.max(1, Number(match[1] ?? 1))
	const dayOfMonth = match[3] ? Number(match[3]) : undefined
	if (dayOfMonth !== undefined && (unit !== "month" || dayOfMonth < 1 || dayOfMonth > 31)) {
		return { unit, interval }
	}
	return dayOfMonth === undefined ? { unit, interval } : { unit, interval, dayOfMonth }
}

export function parseRepeat(text: string): TaskRepeat | undefined {
	const normalized = text.trim().replace(/\s+/g, " ")
	const whenDone = WHEN_DONE_PATTERN.test(normalized)
	const repeat = parseRepeatRule(whenDone ? normalized.replace(WHEN_DONE_PATTERN, "") : normalized)
	return repeat && whenDone ? { ...repeat, whenDone: true } : repeat
}

export function formatRepeat(repeat: TaskRepeat): string {
	const base =
		repeat.interval === 1 ? `every ${repeat.unit}` : `every ${repeat.interval} ${repeat.unit}s`
	const rule = repeat.dayOfMonth ? `${base} on the ${ordinal(repeat.dayOfMonth)}` : base
	return repeat.whenDone ? `${rule} when done` : rule
}

export function describeRepeat(repeat: TaskRepeat): string {
	if (repeat.interval === 1 && !repeat.dayOfMonth && !repeat.whenDone) {
		return { day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" }[repeat.unit]
	}
	const text = formatRepeat(repeat)
	return text.charAt(0).toUpperCase() + text.slice(1)
}

function advance(date: IsoDate, repeat: TaskRepeat, steps: number): IsoDate {
	const amount = repeat.interval * steps
	switch (repeat.unit) {
		case "day":
			return addDays(date, amount)
		case "week":
			return addDays(date, amount * 7)
		case "month":
			return addMonths(date, amount, repeat.dayOfMonth)
		case "year":
			return addMonths(date, amount * 12)
	}
}

export function nextOccurrence(due: IsoDate, repeat: TaskRepeat): IsoDate {
	return advance(due, repeat, 1)
}

export function nextOccurrenceAfter(due: IsoDate, repeat: TaskRepeat, after: IsoDate): IsoDate {
	let steps = 1
	let next = advance(due, repeat, steps)
	while (next <= after && steps < MAX_CATCH_UP_STEPS) next = advance(due, repeat, ++steps)
	return next
}

export function isSameRepeat(left?: TaskRepeat, right?: TaskRepeat): boolean {
	if (!left || !right) return left === right
	return (
		left.unit === right.unit &&
		left.interval === right.interval &&
		left.dayOfMonth === right.dayOfMonth &&
		Boolean(left.whenDone) === Boolean(right.whenDone)
	)
}
