import { addDays, addMonths, parseIsoDate } from "./dates"
import type { ClockTime, IsoDate, TaskRepeat } from "./types"

export interface QuickAddResult {
	title: string
	due?: IsoDate
	time?: ClockTime
	repeat?: TaskRepeat
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const MONTHLY_ON_DAY = /\bevery month on the (\d{1,2})(?:st|nd|rd|th)?\b/i
const EVERY_INTERVAL = /\bevery (?:(\d+) )?(day|week|month|year)s?\b/i
const SHORT_REPEAT = /\b(daily|weekly|monthly|yearly)\b/i
const TOMORROW = /\btomorrow\b(?!['’]\w)/i
const TODAY = /\btoday\b(?!['’]\w)/i
const WEEKDAY =
	/\b(?:on |next )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b(?!['’]\w)/i
const TWELVE_HOUR_TIME = /\b(?:at )?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s?(am|pm)\b/i
const TWENTY_FOUR_HOUR_TIME = /\b(?:at )?([01]?\d|2[0-3]):([0-5]\d)\b/i

const SHORT_REPEAT_UNITS: Record<string, TaskRepeat["unit"]> = {
	daily: "day",
	weekly: "week",
	monthly: "month",
	yearly: "year",
}

function pad(value: number): string {
	return String(value).padStart(2, "0")
}

export function parseQuickAdd(input: string, today: IsoDate): QuickAddResult {
	let title = ` ${input} `
	const result: QuickAddResult = { title: "" }
	const consume = (match: RegExpExecArray) => {
		title = `${title.slice(0, match.index)} ${title.slice(match.index + match[0].length)}`
	}

	const monthlyMatch = MONTHLY_ON_DAY.exec(title)
	const intervalMatch = monthlyMatch ? null : EVERY_INTERVAL.exec(title)
	const shortRepeatMatch = monthlyMatch || intervalMatch ? null : SHORT_REPEAT.exec(title)
	if (monthlyMatch) {
		const dayOfMonth = Math.min(31, Math.max(1, Number(monthlyMatch[1])))
		result.repeat = { unit: "month", interval: 1, dayOfMonth }
		const thisMonth = addMonths(`${today.slice(0, 8)}01`, 0, dayOfMonth)
		result.due = thisMonth >= today ? thisMonth : addMonths(thisMonth, 1, dayOfMonth)
		consume(monthlyMatch)
	} else if (intervalMatch) {
		result.repeat = {
			unit: (intervalMatch[2]?.toLowerCase() ?? "day") as TaskRepeat["unit"],
			interval: Math.max(1, Number(intervalMatch[1] ?? 1)),
		}
		consume(intervalMatch)
	} else if (shortRepeatMatch) {
		result.repeat = {
			unit: SHORT_REPEAT_UNITS[shortRepeatMatch[1]?.toLowerCase() ?? ""] ?? "day",
			interval: 1,
		}
		consume(shortRepeatMatch)
	}

	const tomorrowMatch = TOMORROW.exec(title)
	const todayMatch = tomorrowMatch ? null : TODAY.exec(title)
	const weekdayMatch = tomorrowMatch || todayMatch || result.due ? null : WEEKDAY.exec(title)
	if (tomorrowMatch) {
		result.due = addDays(today, 1)
		consume(tomorrowMatch)
	} else if (todayMatch) {
		result.due = today
		consume(todayMatch)
	} else if (weekdayMatch) {
		const target = WEEKDAYS.indexOf(weekdayMatch[1]?.toLowerCase() ?? "")
		const difference = (target - parseIsoDate(today).getDay() + 7) % 7 || 7
		result.due = addDays(today, difference)
		consume(weekdayMatch)
	}

	const twelveHourMatch = TWELVE_HOUR_TIME.exec(title)
	const twentyFourHourMatch = twelveHourMatch ? null : TWENTY_FOUR_HOUR_TIME.exec(title)
	if (twelveHourMatch) {
		const hours =
			(Number(twelveHourMatch[1]) % 12) + (twelveHourMatch[3]?.toLowerCase() === "pm" ? 12 : 0)
		result.time = `${pad(hours)}:${twelveHourMatch[2] ?? "00"}`
		consume(twelveHourMatch)
	} else if (twentyFourHourMatch) {
		result.time = `${pad(Number(twentyFourHourMatch[1]))}:${twentyFourHourMatch[2]}`
		consume(twentyFourHourMatch)
	}

	if ((result.repeat || result.time) && !result.due) result.due = today
	result.title = title.replace(/\s+/g, " ").trim()
	return result
}
