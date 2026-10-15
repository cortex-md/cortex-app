const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

export interface ParsedTask {
	chips: string[]
	title: string
	markdown: string
	meta: string
}

function nextWeekday(from: Date, weekday: number) {
	const date = new Date(from)
	date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7 || 7))
	return date
}

export function parseTaskInput(input: string, today = new Date(2026, 9, 13)): ParsedTask {
	const lower = input.toLowerCase()
	let title = input
	let date: Date | null = null
	let time: string | null = null
	let repeat: string | null = null

	const cut = (pattern: RegExp) => {
		title = title.replace(pattern, " ")
	}

	if (/\btomorrow\b/u.test(lower)) {
		date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
		cut(/\btomorrow\b/iu)
	} else if (/\btoday\b|\btonight\b/u.test(lower)) {
		date = today
		cut(/\btoday\b|\btonight\b/iu)
	}

	const weekdayMatch = lower.match(
		/\b(?:on |next )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/u,
	)
	const everyMatch = lower.match(
		/\bevery (other )?(day|week|month|year|weekday|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/u,
	)

	if (everyMatch) {
		repeat = `Every ${everyMatch[1] ? "other " : ""}${everyMatch[2]}`
		cut(/\bevery (other )?\w+/iu)
		const weekday = weekdays.indexOf(everyMatch[2] ?? "")
		if (weekday >= 0) date = nextWeekday(today, weekday)
	}

	const nthMatch = lower.match(/\bon the (\d{1,2})(st|nd|rd|th)?\b/u)
	if (nthMatch) {
		const day = Number(nthMatch[1])
		date = new Date(
			today.getFullYear(),
			day > today.getDate() ? today.getMonth() : today.getMonth() + 1,
			day,
		)
		if (repeat === "Every month") repeat = `Every month on the ${day}${nthMatch[2] ?? "th"}`
		cut(/\bon the \d{1,2}(st|nd|rd|th)?\b/iu)
	} else if (weekdayMatch && !everyMatch) {
		date = nextWeekday(today, weekdays.indexOf(weekdayMatch[1] ?? ""))
		cut(/\b(?:on |next )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/iu)
	}

	const timeMatch = lower.match(/\bat (\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/u)
	if (timeMatch) {
		let hour = Number(timeMatch[1])
		if (timeMatch[3] === "pm" && hour < 12) hour += 12
		if (timeMatch[3] === "am" && hour === 12) hour = 0
		time = `${String(hour).padStart(2, "0")}:${timeMatch[2] ?? "00"}`
		cut(/\bat \d{1,2}(:\d{2})?\s*(am|pm)?\b/iu)
		date ??= today
	}

	const chips: string[] = []
	if (date) {
		const isToday = date.getTime() === today.getTime()
		chips.push(
			`${isToday ? "Today" : `${months[date.getMonth()]} ${date.getDate()}`}${time ? ` · ${time}` : ""}`,
		)
	}
	if (repeat) chips.push(repeat)
	if (time) chips.push("Reminder")

	title = title.replace(/\s+/gu, " ").trim()
	title = title ? `${title.charAt(0).toUpperCase()}${title.slice(1)}` : "New task"

	const isoDate = date
		? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
		: ""
	const markdown = `- [ ] ${title}${isoDate ? ` 📅 ${isoDate}${time ? ` ${time}` : ""}` : ""}${repeat ? ` 🔁 ${repeat.toLowerCase()}` : ""}${time ? " ⏰" : ""}`

	return { chips, title, markdown, meta: chips.join(" · ") || "Inbox" }
}
