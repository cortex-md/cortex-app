import { getSortedPropertyOptions } from "../definitions"
import { createObservedPropertyDefinition, isObservablePropertyValue } from "../discovery/observed"
import { getPropertyType } from "../registry"
import type { PrimitivePropertyType, PropertyDefinition, VaultSchema } from "../types"
import { getPropertyValueList, isEmptyPropertyValue } from "../values"
import { TAGS_PROPERTY_DEFINITION } from "../visibility"
import { readDatabaseDate } from "./calendar"
import {
	DATABASE_CONFIG_KEY,
	DATABASE_EDITED_KEY,
	DATABASE_NO_VALUE_GROUP,
	DATABASE_TITLE_KEY,
	type DatabaseConfig,
	type DatabaseFilter,
	type DatabaseFilterOperator,
	type DatabaseGroup,
	type DatabaseQueryContext,
	type DatabaseQueryResult,
	type DatabaseRow,
	type DatabaseSort,
	type DatabaseView,
	type ResolvedDatabaseProperties,
} from "./types"

type Comparable = string | number | boolean

const naturalCollator = new Intl.Collator(undefined, { numeric: true })

const TEXT_OPERATORS: DatabaseFilterOperator[] = [
	"is",
	"is_not",
	"contains",
	"not_contains",
	"is_empty",
	"is_not_empty",
]
const RANGE_OPERATORS: DatabaseFilterOperator[] = [
	"is",
	"is_not",
	"gt",
	"gte",
	"lt",
	"lte",
	"is_empty",
	"is_not_empty",
]
const LIST_OPERATORS: DatabaseFilterOperator[] = ["is", "is_not", "is_empty", "is_not_empty"]
const CHECKBOX_OPERATORS: DatabaseFilterOperator[] = ["is"]

export function getPropertyBaseType(
	definition: PropertyDefinition | undefined,
): PrimitivePropertyType {
	if (!definition) return "text"
	if (definition.type === "created_time" || definition.type === "last_edited_time") return "date"
	return getPropertyType(definition.type)?.baseType ?? "text"
}

export function getDatabaseFilterOperators(
	definition: PropertyDefinition | undefined,
): DatabaseFilterOperator[] {
	switch (getPropertyBaseType(definition)) {
		case "number":
		case "date":
			return RANGE_OPERATORS
		case "select":
		case "person":
		case "tags":
			return LIST_OPERATORS
		case "checkbox":
			return CHECKBOX_OPERATORS
		default:
			return TEXT_OPERATORS
	}
}

function collectReferencedKeys(config: DatabaseConfig | null): Set<string> {
	const keys = new Set<string>()
	for (const view of config?.views ?? []) {
		if (view.group) keys.add(view.group)
		if (view.date) keys.add(view.date)
		if (view.cover) keys.add(view.cover)
		for (const key of view.columns ?? []) keys.add(key)
		for (const filter of view.filters ?? []) keys.add(filter.key)
		for (const sort of view.sort ?? []) keys.add(sort.key)
	}
	for (const template of config?.templates ?? []) {
		for (const key of Object.keys(template.properties ?? {})) keys.add(key)
	}
	return keys
}

export function resolveDatabaseProperties(
	schema: VaultSchema,
	rows: readonly DatabaseRow[],
	config: DatabaseConfig | null,
): ResolvedDatabaseProperties {
	const samples = new Map<string, unknown>()
	for (const row of rows) {
		for (const [key, value] of Object.entries(row.meta)) {
			if (key === DATABASE_CONFIG_KEY) continue
			if (!samples.has(key) || isEmptyPropertyValue(samples.get(key))) samples.set(key, value)
		}
	}
	for (const key of collectReferencedKeys(config)) {
		if (!key.startsWith("$") && !samples.has(key)) samples.set(key, undefined)
	}
	const properties: PropertyDefinition[] = []
	const byKey = new Map<string, PropertyDefinition>()
	const add = (definition: PropertyDefinition) => {
		properties.push(definition)
		byKey.set(definition.key, definition)
	}
	for (const definition of schema.properties) {
		if (samples.has(definition.key)) add(definition)
	}
	for (const [key, value] of samples) {
		if (byKey.has(key)) continue
		if (key === TAGS_PROPERTY_DEFINITION.key) {
			add(TAGS_PROPERTY_DEFINITION)
			continue
		}
		if (value !== undefined && !isObservablePropertyValue(value) && !Array.isArray(value)) continue
		add(createObservedPropertyDefinition(key, Array.isArray(value) ? value[0] : value))
	}
	return { properties, byKey }
}

export function getDatabaseViewColumns(
	view: DatabaseView,
	resolved: ResolvedDatabaseProperties,
): PropertyDefinition[] {
	if (!view.columns) return resolved.properties
	return view.columns.flatMap((key) => {
		const definition = resolved.byKey.get(key)
		return definition ? [definition] : []
	})
}

export function getDatabaseRowValue(row: DatabaseRow, key: string): unknown {
	if (key === DATABASE_TITLE_KEY) return row.title
	if (key === DATABASE_EDITED_KEY) return row.mtime
	return row.meta[key]
}

function toComparable(value: unknown, baseType: PrimitivePropertyType): Comparable | null {
	if (isEmptyPropertyValue(value)) return null
	if (baseType === "number") {
		const number = typeof value === "number" ? value : Number(value)
		return Number.isFinite(number) ? number : null
	}
	if (baseType === "checkbox") return isChecked(value)
	if (baseType === "date" || value instanceof Date) return readDatabaseDate(value)
	return String(value).trim().toLocaleLowerCase()
}

function isChecked(value: unknown): boolean {
	return value === true || value === "true"
}

function isUnresolvedToken(value: unknown, context: DatabaseQueryContext): boolean {
	return context.currentUserId === null && getPropertyValueList(value).includes("$me")
}

function resolveToken(value: unknown, context: DatabaseQueryContext): unknown {
	if (value === "$me") return context.currentUserId ?? ""
	if (value === "$today") return context.today
	return value
}

function compare(left: Comparable, right: Comparable): number {
	if (typeof left === "number" && typeof right === "number") return left - right
	if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right)
	return naturalCollator.compare(String(left), String(right))
}

function matchesFilter(
	row: DatabaseRow,
	filter: DatabaseFilter,
	resolved: ResolvedDatabaseProperties,
	context: DatabaseQueryContext,
): boolean {
	const definition = resolved.byKey.get(filter.key)
	const baseType =
		filter.key === DATABASE_EDITED_KEY
			? "number"
			: filter.key === DATABASE_TITLE_KEY
				? "text"
				: getPropertyBaseType(definition)
	const raw = getDatabaseRowValue(row, filter.key)
	if (baseType === "checkbox") {
		return isChecked(raw) === (resolveToken(filter.value, context) === true)
	}
	if (isUnresolvedToken(filter.value, context)) {
		return filter.op === "is_not" || filter.op === "not_contains"
	}
	const values = getPropertyValueList(raw)
		.map((value) => toComparable(value, baseType))
		.filter((value): value is Comparable => value !== null)
	const targets = getPropertyValueList(resolveToken(filter.value, context))
		.map((value) => toComparable(resolveToken(value, context), baseType))
		.filter((value): value is Comparable => value !== null)
	switch (filter.op) {
		case "is_empty":
			return values.length === 0
		case "is_not_empty":
			return values.length > 0
		case "is":
			return targets.length === 0 || values.some((value) => targets.includes(value))
		case "is_not":
			return targets.length === 0 || !values.some((value) => targets.includes(value))
		case "contains":
			if (targets.length === 0) return true
			return values.some((value) =>
				targets.every((target) => String(value).includes(String(target))),
			)
		case "not_contains":
			return !values.some((value) =>
				targets.some((target) => String(value).includes(String(target))),
			)
		default: {
			const target = targets[0]
			if (target === undefined) return true
			return values.some((value) => {
				const result = compare(value, target)
				if (filter.op === "gt") return result > 0
				if (filter.op === "gte") return result >= 0
				if (filter.op === "lt") return result < 0
				return result <= 0
			})
		}
	}
}

export function filterDatabaseRows(
	rows: readonly DatabaseRow[],
	filters: readonly DatabaseFilter[] | undefined,
	resolved: ResolvedDatabaseProperties,
	context: DatabaseQueryContext,
): DatabaseRow[] {
	if (!filters?.length) return [...rows]
	return rows.filter((row) =>
		filters.every((filter) => matchesFilter(row, filter, resolved, context)),
	)
}

export function searchDatabaseRows(rows: readonly DatabaseRow[], search: string): DatabaseRow[] {
	const terms = search.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean)
	if (!terms.length) return [...rows]
	return rows.filter((row) => {
		const haystack = [
			row.title,
			row.excerpt,
			...Object.entries(row.meta)
				.filter(([key]) => key !== DATABASE_CONFIG_KEY)
				.flatMap(([, value]) => getPropertyValueList(value).map(String)),
		]
			.join("\n")
			.toLocaleLowerCase()
		return terms.every((term) => haystack.includes(term))
	})
}

function createSortKey(
	sort: DatabaseSort,
	resolved: ResolvedDatabaseProperties,
): (row: DatabaseRow) => Comparable | null {
	if (sort.key === DATABASE_TITLE_KEY) return (row) => row.title.toLocaleLowerCase()
	if (sort.key === DATABASE_EDITED_KEY) return (row) => row.mtime
	const definition = resolved.byKey.get(sort.key)
	const baseType = getPropertyBaseType(definition)
	if (baseType === "select" && definition) {
		const order = new Map(
			getSortedPropertyOptions(definition).map((option, index) => [option.id, index]),
		)
		return (row) => {
			const indexes = getPropertyValueList(row.meta[sort.key]).map(
				(value) => order.get(String(value)) ?? order.size,
			)
			return indexes.length ? Math.min(...indexes) : null
		}
	}
	return (row) => toComparable(getPropertyValueList(row.meta[sort.key])[0], baseType)
}

export function sortDatabaseRows(
	rows: readonly DatabaseRow[],
	sorts: readonly DatabaseSort[] | undefined,
	resolved: ResolvedDatabaseProperties,
	manualOrder?: readonly string[],
): DatabaseRow[] {
	const keys = (sorts ?? []).map((sort) => ({
		read: createSortKey(sort, resolved),
		direction: sort.dir === "desc" ? -1 : 1,
	}))
	const manual = new Map((manualOrder ?? []).map((name, index) => [name, index]))
	const decorated = rows.map((row) => ({ row, values: keys.map((key) => key.read(row)) }))
	decorated.sort((left, right) => {
		for (let index = 0; index < keys.length; index++) {
			const a = left.values[index]
			const b = right.values[index]
			if (a === b) continue
			if (a === null) return 1
			if (b === null) return -1
			const result = compare(a, b) * keys[index].direction
			if (result !== 0) return result
		}
		if (manual.size) {
			const a = manual.get(left.row.title) ?? Number.MAX_SAFE_INTEGER
			const b = manual.get(right.row.title) ?? Number.MAX_SAFE_INTEGER
			if (a !== b) return a - b
		}
		return (
			naturalCollator.compare(left.row.title, right.row.title) ||
			left.row.path.localeCompare(right.row.path)
		)
	})
	return decorated.map((entry) => entry.row)
}

function noValueGroup(rows: DatabaseRow[]): DatabaseGroup {
	return { key: DATABASE_NO_VALUE_GROUP, label: "No value", option: null, value: undefined, rows }
}

export function groupDatabaseRows(
	rows: readonly DatabaseRow[],
	groupKey: string | undefined,
	resolved: ResolvedDatabaseProperties,
): DatabaseGroup[] {
	const definition = groupKey ? resolved.byKey.get(groupKey) : undefined
	if (!groupKey || !definition) {
		return [{ key: "all", label: "", option: null, value: undefined, rows: [...rows] }]
	}
	const baseType = getPropertyBaseType(definition)
	const empty: DatabaseRow[] = []
	if (baseType === "select") {
		const options = getSortedPropertyOptions(definition)
		const buckets = new Map(options.map((option) => [option.id, [] as DatabaseRow[]]))
		for (const row of rows) {
			const values = getPropertyValueList(row.meta[groupKey]).map(String)
			const matched = values.filter((value) => buckets.has(value))
			if (!matched.length) empty.push(row)
			for (const value of matched) buckets.get(value)?.push(row)
		}
		return [
			...options.map((option) => ({
				key: option.id,
				label: option.label,
				option,
				value: option.id,
				rows: buckets.get(option.id) ?? [],
			})),
			noValueGroup(empty),
		]
	}
	if (baseType === "checkbox") {
		const checked = rows.filter((row) => isChecked(row.meta[groupKey]))
		const unchecked = rows.filter((row) => !isChecked(row.meta[groupKey]))
		return [
			{ key: "true", label: "Checked", option: null, value: true, rows: checked },
			{ key: "false", label: "Unchecked", option: null, value: false, rows: unchecked },
		]
	}
	const buckets = new Map<string, { value: unknown; rows: DatabaseRow[] }>()
	for (const row of rows) {
		let grouped = false
		for (const value of getPropertyValueList(row.meta[groupKey])) {
			const key = toComparable(value, baseType)
			if (key === null) continue
			const bucketKey = String(key)
			const bucket = buckets.get(bucketKey) ?? { value, rows: [] }
			if (bucket.rows.at(-1) === row) continue
			bucket.rows.push(row)
			buckets.set(bucketKey, bucket)
			grouped = true
		}
		if (!grouped) empty.push(row)
	}
	return [
		...[...buckets.entries()]
			.sort(([left], [right]) => naturalCollator.compare(left, right))
			.map(([key, bucket]) => ({
				key,
				label: String(bucket.value),
				option: null,
				value: bucket.value,
				rows: bucket.rows,
			})),
		noValueGroup(empty),
	]
}

export function queryDatabaseView(
	rows: readonly DatabaseRow[],
	view: DatabaseView,
	resolved: ResolvedDatabaseProperties,
	context: DatabaseQueryContext,
	search = "",
): DatabaseQueryResult {
	const filtered = searchDatabaseRows(
		filterDatabaseRows(rows, view.filters, resolved, context),
		search,
	)
	const sorted = sortDatabaseRows(filtered, view.sort, resolved, view.order)
	return {
		rows: sorted,
		groups: groupDatabaseRows(sorted, view.group, resolved),
		totalCount: rows.length,
		matchedCount: sorted.length,
	}
}

export function isDatabasePropertyReadOnly(
	key: string,
	resolved?: ResolvedDatabaseProperties,
): boolean {
	if (key.startsWith("$")) return true
	const definition = resolved?.byKey.get(key)
	return definition ? Boolean(getPropertyType(definition.type)?.readOnly) : false
}

export function getDatabaseRowPreset(
	view: DatabaseView,
	group: DatabaseGroup | null,
	context: DatabaseQueryContext,
	resolved?: ResolvedDatabaseProperties,
): Record<string, unknown> {
	const preset: Record<string, unknown> = {}
	for (const filter of view.filters ?? []) {
		if (filter.op !== "is" || isDatabasePropertyReadOnly(filter.key, resolved)) continue
		if (isUnresolvedToken(filter.value, context)) continue
		const value = resolveToken(filter.value, context)
		if (!isEmptyPropertyValue(value)) preset[filter.key] = value
	}
	if (
		view.group &&
		group &&
		group.key !== DATABASE_NO_VALUE_GROUP &&
		group.value !== undefined &&
		!isDatabasePropertyReadOnly(view.group, resolved)
	) {
		preset[view.group] = group.value
	}
	return preset
}

export function getDatabaseAccentKey(
	view: DatabaseView,
	resolved: ResolvedDatabaseProperties,
): string | undefined {
	const grouped = view.group ? resolved.byKey.get(view.group) : undefined
	if (grouped && getPropertyBaseType(grouped) === "select") return grouped.key
	return resolved.properties.find((definition) => getPropertyBaseType(definition) === "select")?.key
}
