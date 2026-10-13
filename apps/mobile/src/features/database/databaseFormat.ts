import {
	getPropertyValueList,
	isEmptyPropertyValue,
	type PropertyColor,
	type PropertyDefinition,
	parsePropertyDate,
	type ResolvedAuthorConfig,
	resolvePropertyOption,
} from "@cortex/properties"
import {
	type DatabaseFilter,
	type DatabaseFilterOperator,
	type DatabaseRow,
	type DatabaseView,
	type DatabaseViewType,
	getDatabaseAccentKey,
	getPropertyBaseType,
	readDatabaseDate,
	type ResolvedDatabaseProperties,
} from "@cortex/properties/database"

import type { StatusTone } from "@/components/ui/StatusPill"

export const DATABASE_VIEW_OPTIONS: { label: string; value: DatabaseViewType }[] = [
	{ label: "Table", value: "table" },
	{ label: "Board", value: "board" },
	{ label: "Calendar", value: "calendar" },
	{ label: "Gallery", value: "gallery" },
]

export type ViewOptionsTab = "filter" | "sort" | "group" | "props"

export const VIEW_OPTIONS_TABS: { label: string; value: ViewOptionsTab }[] = [
	{ label: "Filter", value: "filter" },
	{ label: "Sort", value: "sort" },
	{ label: "Group", value: "group" },
	{ label: "Properties", value: "props" },
]

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" })
const SHORT_DATE = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" })
const LONG_DATE = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "short",
	weekday: "short",
})
const DAY_MS = 86_400_000

const OPERATOR_LABELS: Record<DatabaseFilterOperator, string> = {
	contains: "contains",
	gt: "is after",
	gte: "is on or after",
	is: "is",
	is_empty: "is empty",
	is_not: "is not",
	is_not_empty: "is not empty",
	lt: "is before",
	lte: "is on or before",
	not_contains: "does not contain",
}

export interface DatabaseRoles {
	statusKey?: string
	ownerKey?: string
	dateKey?: string
	doneOptionId?: string
}

export type DueTone = "over" | "soon" | "plain" | "muted"

export interface DueLabel {
	label: string
	tone: DueTone
}

export function resolveDatabaseRoles(
	view: DatabaseView | undefined,
	resolved: ResolvedDatabaseProperties,
): DatabaseRoles {
	const statusKey = view ? getDatabaseAccentKey(view, resolved) : undefined
	const owner = resolved.properties.find(
		(definition) => getPropertyBaseType(definition) === "person",
	)
	const isDate = (key: string | undefined) =>
		key !== undefined && getPropertyBaseType(resolved.byKey.get(key)) === "date"
	const sortKey = view?.sort?.[0]?.key
	const dateKey = isDate(view?.date)
		? view?.date
		: isDate(sortKey)
			? sortKey
			: resolved.properties.find((definition) => getPropertyBaseType(definition) === "date")?.key
	const status = statusKey ? resolved.byKey.get(statusKey) : undefined
	const done = status?.options?.find((option) => /done|complete/iu.test(option.label))
	return { dateKey, doneOptionId: done?.id, ownerKey: owner?.key, statusKey }
}

export function optionTone(color: PropertyColor | undefined): StatusTone {
	switch (color) {
		case "green":
			return "done"
		case "amber":
			return "review"
		case "gray":
			return "backlog"
		case "red":
			return "error"
		default:
			return "progress"
	}
}

export function firstName(name: string): string {
	return name.trim().split(/\s+/u)[0] ?? name
}

export function resolvePersonName(value: unknown, authorConfig: ResolvedAuthorConfig): string {
	const id = String(value)
	if (authorConfig.variant === "person") {
		const person = authorConfig.options.find((option) => option.id === id)
		if (person) return person.label
	}
	return id
}

function diffDays(value: unknown, today: string): { date: Date; days: number } | null {
	const iso = readDatabaseDate(value)
	const date = parsePropertyDate(iso ?? undefined)
	const base = parsePropertyDate(today)
	if (!date || !base) return null
	return { date, days: Math.round((date.getTime() - base.getTime()) / DAY_MS) }
}

export function formatRelativeDue(value: unknown, today: string, done = false): DueLabel {
	const first = getPropertyValueList(value)[0]
	const diff = first === undefined ? null : diffDays(first, today)
	if (!diff) return { label: "—", tone: "muted" }
	const { date, days } = diff
	const over = days < 0 && !done
	if (days === 0) return { label: "Today", tone: "soon" }
	if (days === 1) return { label: "Tomorrow", tone: "soon" }
	if (days === -1) return { label: "Yesterday", tone: over ? "over" : "plain" }
	if (days < 0) return { label: `${-days} days late`, tone: over ? "over" : "plain" }
	if (days < 7) return { label: WEEKDAY.format(date), tone: days <= 2 ? "soon" : "plain" }
	return { label: SHORT_DATE.format(date), tone: "plain" }
}

export function formatLongDue(value: unknown, today: string, done = false): DueLabel {
	const first = getPropertyValueList(value)[0]
	const diff = first === undefined ? null : diffDays(first, today)
	if (!diff) return { label: "Empty", tone: "muted" }
	const label = LONG_DATE.format(diff.date)
	if (diff.days < 0 && !done) {
		const late = -diff.days === 1 ? "1 day late" : `${-diff.days} days late`
		return { label: `${label} · ${late}`, tone: "over" }
	}
	return { label, tone: "plain" }
}

export function formatDayHeading(iso: string): string {
	const date = parsePropertyDate(iso)
	return date ? LONG_DATE.format(date) : iso
}

export function formatEditedAgo(mtime: number, now = Date.now()): string {
	if (!mtime) return "just now"
	const minutes = Math.max(0, Math.round((now - mtime) / 60_000))
	if (minutes < 1) return "just now"
	if (minutes < 60) return `${minutes} min ago`
	const hours = Math.round(minutes / 60)
	if (hours < 24) return `${hours} h ago`
	const days = Math.round(hours / 24)
	if (days === 1) return "yesterday"
	return SHORT_DATE.format(new Date(mtime))
}

export function isRowDone(row: DatabaseRow, roles: DatabaseRoles): boolean {
	if (!roles.statusKey || !roles.doneOptionId) return false
	return getPropertyValueList(row.meta[roles.statusKey]).map(String).includes(roles.doneOptionId)
}

export function formatPropertyValue(
	definition: PropertyDefinition | undefined,
	value: unknown,
	authorConfig: ResolvedAuthorConfig,
): string {
	if (isEmptyPropertyValue(value)) return ""
	const baseType = getPropertyBaseType(definition)
	const values = getPropertyValueList(value)
	if (baseType === "select" && definition) {
		return values.map((item) => resolvePropertyOption(definition, item).label).join(", ")
	}
	if (baseType === "person") {
		return values.map((item) => resolvePersonName(item, authorConfig)).join(", ")
	}
	if (baseType === "tags") return values.map((item) => `#${String(item)}`).join(" ")
	if (baseType === "checkbox") return value === true || value === "true" ? "Yes" : "No"
	return values.map(String).join(", ")
}

export function hideDoneFilter(roles: DatabaseRoles): DatabaseFilter | null {
	if (!roles.statusKey || !roles.doneOptionId) return null
	return { key: roles.statusKey, op: "is_not", value: roles.doneOptionId }
}

export function mineFilter(roles: DatabaseRoles): DatabaseFilter | null {
	if (!roles.ownerKey) return null
	return { key: roles.ownerKey, op: "is", value: "$me" }
}

export function sameFilter(left: DatabaseFilter, right: DatabaseFilter): boolean {
	return (
		left.key === right.key &&
		left.op === right.op &&
		JSON.stringify(left.value) === JSON.stringify(right.value)
	)
}

export function hasFilter(view: DatabaseView | undefined, filter: DatabaseFilter | null): boolean {
	if (!view || !filter) return false
	return (view.filters ?? []).some((item) => sameFilter(item, filter))
}

export function setFilter(view: DatabaseView, filter: DatabaseFilter, on: boolean): DatabaseView {
	const rest = (view.filters ?? []).filter((item) => !sameFilter(item, filter))
	const filters = on ? [...rest, filter] : rest
	return { ...view, filters: filters.length ? filters : undefined }
}

function filterValueLabel(
	value: unknown,
	definition: PropertyDefinition | undefined,
	authorConfig: ResolvedAuthorConfig,
): string {
	return getPropertyValueList(value)
		.map((item) => {
			if (item === "$me") return "me"
			if (item === "$today") return "today"
			return formatPropertyValue(definition, item, authorConfig)
		})
		.join(", ")
}

export interface FilterChipLabel {
	property: string
	operator: string
	value: string
}

export function describeFilter(
	filter: DatabaseFilter,
	resolved: ResolvedDatabaseProperties,
	authorConfig: ResolvedAuthorConfig,
): FilterChipLabel {
	const definition = resolved.byKey.get(filter.key)
	const property =
		filter.key === "$title" ? "Name" : filter.key === "$edited" ? "Edited" : (definition?.name ?? filter.key)
	return {
		operator: OPERATOR_LABELS[filter.op],
		property,
		value: filterValueLabel(filter.value, definition, authorConfig),
	}
}

export function propertyName(key: string, resolved: ResolvedDatabaseProperties): string {
	if (key === "$title") return "Name"
	if (key === "$edited") return "Edited"
	return resolved.byKey.get(key)?.name ?? key
}

export function sortTokenLabel(
	view: DatabaseView | undefined,
	resolved: ResolvedDatabaseProperties,
): string {
	const sort = view?.sort?.[0]
	if (!sort) return "Manual"
	return `${propertyName(sort.key, resolved)} ${sort.dir === "desc" ? "↓" : "↑"}`
}

export function groupTokenLabel(
	view: DatabaseView | undefined,
	resolved: ResolvedDatabaseProperties,
): string {
	if (!view?.group || !resolved.byKey.has(view.group)) return "No grouping"
	return `Group: ${propertyName(view.group, resolved)}`
}

export function groupableProperties(resolved: ResolvedDatabaseProperties): PropertyDefinition[] {
	return resolved.properties.filter((definition) => {
		const baseType = getPropertyBaseType(definition)
		return baseType === "select" || baseType === "person" || baseType === "checkbox"
	})
}

export function sortableDateProperty(
	resolved: ResolvedDatabaseProperties,
	roles: DatabaseRoles,
): PropertyDefinition | undefined {
	return roles.dateKey ? resolved.byKey.get(roles.dateKey) : undefined
}

export function columnWidth(definition: PropertyDefinition, roles: DatabaseRoles): number {
	if (definition.key === roles.statusKey) return 104
	switch (getPropertyBaseType(definition)) {
		case "person":
			return 112
		case "date":
			return 104
		case "select":
			return 92
		case "tags":
			return 120
		case "number":
		case "checkbox":
			return 88
		default:
			return 140
	}
}

export function viewTitle(type: DatabaseViewType | undefined): string {
	const label = DATABASE_VIEW_OPTIONS.find((option) => option.value === type)?.label ?? "Table"
	return `${label} view`
}

export function noteCountLabel(count: number): string {
	return `${count} ${count === 1 ? "note" : "notes"}`
}
