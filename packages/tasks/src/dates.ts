import type { ClockTime, IsoDate } from "./types"

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_NAMES = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
]
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

function pad(value: number): string {
	return String(value).padStart(2, "0")
}

export function isIsoDate(value: string): boolean {
	const match = ISO_DATE_PATTERN.exec(value)
	if (!match) return false
	const date = parseIsoDate(value)
	return date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])
}

export function isClockTime(value: string): boolean {
	return CLOCK_TIME_PATTERN.test(value)
}

export function parseIsoDate(value: IsoDate): Date {
	const [year, month, day] = value.split("-").map(Number)
	return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

export function toIsoDate(date: Date): IsoDate {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toClockTime(date: Date): ClockTime {
	return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function clockTimeToMinutes(time: ClockTime): number {
	const [hours, minutes] = time.split(":").map(Number)
	return (hours ?? 0) * 60 + (minutes ?? 0)
}

export function minutesToClockTime(totalMinutes: number): ClockTime {
	const normalized = ((totalMinutes % 1440) + 1440) % 1440
	return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`
}

export function addDays(date: IsoDate, days: number): IsoDate {
	const value = parseIsoDate(date)
	value.setDate(value.getDate() + days)
	return toIsoDate(value)
}

export function addMonths(date: IsoDate, months: number, dayOfMonth?: number): IsoDate {
	const value = parseIsoDate(date)
	const targetDay = dayOfMonth ?? value.getDate()
	value.setDate(1)
	value.setMonth(value.getMonth() + months)
	const lastDay = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate()
	value.setDate(Math.min(targetDay, lastDay))
	return toIsoDate(value)
}

export function combineDateTime(date: IsoDate, time: ClockTime): Date {
	const value = parseIsoDate(date)
	const minutes = clockTimeToMinutes(time)
	value.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
	return value
}

export function shiftDateTime(
	date: IsoDate,
	time: ClockTime,
	deltaMinutes: number,
): { date: IsoDate; time: ClockTime } {
	const value = combineDateTime(date, time)
	value.setMinutes(value.getMinutes() + deltaMinutes)
	return { date: toIsoDate(value), time: toClockTime(value) }
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
	const start = parseIsoDate(from)
	const end = parseIsoDate(to)
	return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

export function formatRelativeDay(date: IsoDate, today: IsoDate): string {
	const difference = daysBetween(today, date)
	if (difference === 0) return "Today"
	if (difference === 1) return "Tomorrow"
	if (difference === -1) return "Yesterday"
	const value = parseIsoDate(date)
	if (difference > 1 && difference < 7) return DAY_NAMES[value.getDay()] ?? date
	return `${DAY_NAMES[value.getDay()]}, ${MONTH_NAMES[value.getMonth()]} ${value.getDate()}`
}

export function formatShortDay(date: IsoDate): string {
	return DAY_NAMES[parseIsoDate(date).getDay()] ?? date
}
