import { parseIsoDate, toIsoDate } from "@cortex/tasks"
import { Button } from "@cortex/ui"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useState } from "react"
import { formatMonth } from "@/utils/format"

const WEEKDAY_LABELS = [
	{ key: "mon", label: "M" },
	{ key: "tue", label: "T" },
	{ key: "wed", label: "W" },
	{ key: "thu", label: "T" },
	{ key: "fri", label: "F" },
	{ key: "sat", label: "S" },
	{ key: "sun", label: "S" },
]
const DAY_LABEL_FORMAT = new Intl.DateTimeFormat(undefined, {
	weekday: "long",
	month: "long",
	day: "numeric",
})

interface CalendarDay {
	date: string
	day: number
	outside: boolean
}

function buildMonthGrid(month: Date): CalendarDay[] {
	const first = new Date(month.getFullYear(), month.getMonth(), 1)
	const offset = (first.getDay() + 6) % 7
	const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
	const weeks = Math.ceil((offset + daysInMonth) / 7)
	return Array.from({ length: weeks * 7 }, (_, index) => {
		const value = new Date(month.getFullYear(), month.getMonth(), 1 - offset + index)
		return {
			date: toIsoDate(value),
			day: value.getDate(),
			outside: value.getMonth() !== month.getMonth(),
		}
	})
}

interface TaskMiniCalendarProps {
	label: string
	selected: string | undefined
	today: string
	onSelect: (date: string) => void
}

export function TaskMiniCalendar({ label, selected, today, onSelect }: TaskMiniCalendarProps) {
	const [month, setMonth] = useState(() => {
		const initial = parseIsoDate(selected ?? today)
		return new Date(initial.getFullYear(), initial.getMonth(), 1)
	})
	const days = buildMonthGrid(month)
	const shiftMonth = (delta: number) =>
		setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))

	return (
		<div className="task-field">
			<div className="task-field-label">
				<span>
					{label} · {formatMonth(month)}
				</span>
				<span className="task-calendar-nav">
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label="Previous month"
						onClick={() => shiftMonth(-1)}
					>
						<ChevronLeftIcon />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label="Next month"
						onClick={() => shiftMonth(1)}
					>
						<ChevronRightIcon />
					</Button>
				</span>
			</div>
			<div className="task-calendar">
				{WEEKDAY_LABELS.map((weekday) => (
					<span key={weekday.key} className="task-calendar-weekday" aria-hidden="true">
						{weekday.label}
					</span>
				))}
				{days.map((day) => (
					<Button
						size="sm"
						key={day.date}
						variant="ghost"
						className="task-calendar-day"
						data-outside={day.outside ? "true" : undefined}
						data-today={day.date === today ? "true" : undefined}
						data-selected={day.date === selected ? "true" : undefined}
						aria-pressed={day.date === selected}
						aria-label={DAY_LABEL_FORMAT.format(parseIsoDate(day.date))}
						onClick={() => onSelect(day.date)}
					>
						{day.day}
					</Button>
				))}
			</div>
		</div>
	)
}
