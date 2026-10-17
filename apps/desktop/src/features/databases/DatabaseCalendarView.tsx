import { updateDatabaseCell } from "@cortex/core"
import {
	getPropertyValueList,
	type PropertyDefinition,
	type ResolvedAuthorConfig,
	resolvePropertyOption,
} from "@cortex/properties"
import {
	bucketRowsByDate,
	buildMonthGrid,
	type DatabaseRow,
	getPropertyBaseType,
	isDatabasePropertyReadOnly,
	type ResolvedDatabaseProperties,
} from "@cortex/properties/database"
import { Button, Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@cortex/ui"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react"
import { type DragEvent, useMemo, useState } from "react"
import { acceptsRowDrag, DatabaseCard, readDraggedRowPath, startRowDrag } from "./DatabaseCard"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MAX_EVENTS_PER_DAY = 3
const MONTH_FORMAT = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" })

interface DatabaseCalendarViewProps {
	folderPath: string
	rows: DatabaseRow[]
	dateKey: string | undefined
	resolved: ResolvedDatabaseProperties
	columns: PropertyDefinition[]
	selectedPath: string | null
	authorConfig: ResolvedAuthorConfig
	readOnly: boolean
	today: string
	accentKey: string | undefined
	onSelect: (path: string) => void
	onCreateOnDate: (dateKey: string, date: string) => void
}

export function getCalendarDateKey(
	dateKey: string | undefined,
	resolved: ResolvedDatabaseProperties,
): string | undefined {
	if (dateKey && resolved.byKey.has(dateKey)) return dateKey
	return resolved.properties.find(
		(definition) =>
			getPropertyBaseType(definition) === "date" &&
			definition.type !== "created_time" &&
			definition.type !== "last_edited_time",
	)?.key
}

function monthFromToday(today: string, offset: number): { year: number; month: number } {
	const [year, month] = today.split("-").map(Number)
	const date = new Date(year, month - 1 + offset, 1)
	return { year: date.getFullYear(), month: date.getMonth() }
}

interface CalendarDayProps {
	date: string
	day: number
	inMonth: boolean
	isToday: boolean
	rows: DatabaseRow[]
	selectedPath: string | null
	readOnly: boolean
	onSelect: (path: string) => void
	onCreate: (date: string) => void
	onDropRow: (path: string, date: string) => void
	eventColor: (row: DatabaseRow) => string | undefined
}

function CalendarDay({
	date,
	day,
	inMonth,
	isToday,
	rows,
	selectedPath,
	readOnly,
	onSelect,
	onCreate,
	onDropRow,
	eventColor,
}: CalendarDayProps) {
	const [expanded, setExpanded] = useState(false)
	const [dropping, setDropping] = useState(false)
	const visible = expanded ? rows : rows.slice(0, MAX_EVENTS_PER_DAY)
	const hidden = rows.length - visible.length
	const handleDrop = (event: DragEvent) => {
		event.preventDefault()
		setDropping(false)
		const path = readDraggedRowPath(event)
		if (path) onDropRow(path, date)
	}
	return (
		<section
			aria-label={date}
			className="db-cal-day"
			data-out={!inMonth || undefined}
			data-today={isToday || undefined}
			data-drop-target={dropping || undefined}
			onDragOver={(event) => {
				if (readOnly || !acceptsRowDrag(event)) return
				event.preventDefault()
				if (!dropping) setDropping(true)
			}}
			onDragLeave={() => setDropping(false)}
			onDrop={handleDrop}
		>
			<div className="db-cal-day-head">
				<span className="db-cal-day-number">{day}</span>
				{!readOnly && (
					<Button
						variant="ghost"
						size="icon-xs"
						className="db-cal-add"
						aria-label={`New note on ${date}`}
						onClick={() => onCreate(date)}
					>
						<PlusIcon />
					</Button>
				)}
			</div>
			{visible.map((row) => (
				<Button
					size="sm"
					key={row.path}
					variant="ghost"
					className="db-cal-event"
					data-selected={row.path === selectedPath || undefined}
					draggable={!readOnly}
					onDragStart={(event) => startRowDrag(event, row.path)}
					onClick={() => onSelect(row.path)}
				>
					<i data-color={eventColor(row)} aria-hidden="true" />
					<span>{row.title}</span>
				</Button>
			))}
			{hidden > 0 && (
				<Button size="sm" variant="ghost" className="db-cal-more" onClick={() => setExpanded(true)}>
					{hidden} more
				</Button>
			)}
		</section>
	)
}

export function DatabaseCalendarView({
	folderPath,
	rows,
	dateKey,
	resolved,
	columns,
	selectedPath,
	authorConfig,
	readOnly: viewReadOnly,
	today,
	accentKey,
	onSelect,
	onCreateOnDate,
}: DatabaseCalendarViewProps) {
	const [offset, setOffset] = useState(0)
	const key = getCalendarDateKey(dateKey, resolved)
	const readOnly = viewReadOnly || (key !== undefined && isDatabasePropertyReadOnly(key, resolved))
	const { year, month } = monthFromToday(today, offset)
	const days = useMemo(() => buildMonthGrid(year, month, 1), [year, month])
	const buckets = useMemo(() => bucketRowsByDate(rows, key), [rows, key])
	const trayProperties = useMemo(
		() => columns.filter((definition) => definition.key !== key).slice(0, 2),
		[columns, key],
	)

	if (!key) {
		return (
			<Empty className="db-empty">
				<EmptyHeader>
					<EmptyTitle>Calendar needs a date property</EmptyTitle>
					<EmptyDescription>
						Add a Date property such as Due to a note in this database.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	const accent = accentKey ? resolved.byKey.get(accentKey) : undefined
	const eventColor = (row: DatabaseRow) => {
		if (!accent || !accentKey) return undefined
		const value = getPropertyValueList(row.meta[accentKey])[0]
		return value === undefined ? undefined : resolvePropertyOption(accent, value).color
	}

	const moveRow = (path: string, date: string) =>
		void updateDatabaseCell(folderPath, path, key, date)

	return (
		<div className="db-cal">
			<div className="db-cal-main">
				<div className="db-cal-top">
					<h3>{MONTH_FORMAT.format(new Date(year, month, 1))}</h3>
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label="Previous month"
						onClick={() => setOffset((value) => value - 1)}
					>
						<ChevronLeftIcon />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						aria-label="Next month"
						onClick={() => setOffset((value) => value + 1)}
					>
						<ChevronRightIcon />
					</Button>
					<Button variant="secondary" size="xs" onClick={() => setOffset(0)}>
						Today
					</Button>
				</div>
				<div className="db-cal-grid">
					{WEEKDAYS.map((weekday) => (
						<div key={weekday} className="db-cal-weekday">
							{weekday}
						</div>
					))}
					{days.map((day) => (
						<CalendarDay
							key={day.date}
							date={day.date}
							day={day.day}
							inMonth={day.inMonth}
							isToday={day.date === today}
							rows={buckets.byDate.get(day.date) ?? []}
							selectedPath={selectedPath}
							readOnly={readOnly}
							onSelect={onSelect}
							onCreate={(date) => onCreateOnDate(key, date)}
							onDropRow={moveRow}
							eventColor={eventColor}
						/>
					))}
				</div>
			</div>
			<aside className="db-cal-tray" aria-label="Notes without a date">
				<h4>No date · {buckets.undated.length}</h4>
				{buckets.undated.map((row) => (
					<DatabaseCard
						key={row.path}
						row={row}
						properties={trayProperties}
						authorConfig={authorConfig}
						today={today}
						selected={row.path === selectedPath}
						draggable={!readOnly}
						onSelect={onSelect}
					/>
				))}
			</aside>
		</div>
	)
}
