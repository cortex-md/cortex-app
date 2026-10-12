import { getPropertyValueList } from "../values"
import type { DatabaseRow } from "./types"

export interface DatabaseCalendarDay {
	date: string
	day: number
	inMonth: boolean
}

export interface DatabaseCalendarBuckets {
	byDate: Map<string, DatabaseRow[]>
	undated: DatabaseRow[]
}

export function toIsoDate(date: Date): string {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, "0")
	const day = String(date.getDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
}

export function buildMonthGrid(
	year: number,
	month: number,
	weekStartsOn: 0 | 1 = 1,
): DatabaseCalendarDay[] {
	const first = new Date(year, month, 1)
	const offset = (first.getDay() - weekStartsOn + 7) % 7
	const daysInMonth = new Date(year, month + 1, 0).getDate()
	const cells = Math.ceil((offset + daysInMonth) / 7) * 7
	const days: DatabaseCalendarDay[] = []
	for (let index = 0; index < cells; index++) {
		const date = new Date(year, month, 1 - offset + index)
		days.push({ date: toIsoDate(date), day: date.getDate(), inMonth: date.getMonth() === month })
	}
	return days
}

export function readDatabaseDate(value: unknown): string | null {
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : toIsoDate(value)
	if (typeof value !== "string") return null
	const text = value.trim()
	const match = /^(\d{4}-\d{2}-\d{2})(T)?/u.exec(text)
	if (!match) return null
	if (!match[2]) return match[1]
	const instant = new Date(text)
	return Number.isNaN(instant.getTime()) ? match[1] : toIsoDate(instant)
}

export function bucketRowsByDate(
	rows: readonly DatabaseRow[],
	key: string | undefined,
): DatabaseCalendarBuckets {
	const byDate = new Map<string, DatabaseRow[]>()
	const undated: DatabaseRow[] = []
	for (const row of rows) {
		const date = key ? readDatabaseDate(getPropertyValueList(row.meta[key])[0]) : null
		if (!date) {
			undated.push(row)
			continue
		}
		const bucket = byDate.get(date)
		if (bucket) bucket.push(row)
		else byDate.set(date, [row])
	}
	return { byDate, undated }
}
