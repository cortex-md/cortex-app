import {
	getPropertyType,
	isEmptyPropertyValue,
	resolvePropertyOption,
	type VaultSchema,
} from "@cortex/properties"
import type {
	DatabaseBoardGroup,
	DatabaseDefinition,
	DatabaseFilter,
	DatabaseIndex,
	DatabaseQueryResult,
	DatabaseRow,
	DatabaseSort,
	DatabaseViewDefinition,
} from "./types"
import { getDatabaseMembershipIdsFromMeta } from "./embeds"

function compareValues(left: unknown, right: unknown): number {
	if (left === right) return 0
	if (isEmptyPropertyValue(left)) return 1
	if (isEmptyPropertyValue(right)) return -1
	if (typeof left === "number" && typeof right === "number") return left - right
	return String(left).localeCompare(String(right), undefined, {
		numeric: true,
		sensitivity: "base",
	})
}

function getSortValue(row: DatabaseRow, sort: DatabaseSort): unknown {
	if (sort.target === "title") return row.title
	if (sort.target === "path") return row.relativePath
	if (sort.target === "updatedAt") return row.updatedAt
	if (sort.target === "createdAt") return row.createdAt
	return sort.propertyKey ? row.properties[sort.propertyKey] : undefined
}

function matchesDatabase(database: DatabaseDefinition, row: DatabaseRow): boolean {
	return getDatabaseMembershipIdsFromMeta(row.properties).includes(database.id)
}

function matchesContains(value: unknown, expected: unknown): boolean {
	if (Array.isArray(value)) {
		return value.some(
			(item) => String(item).toLocaleLowerCase() === String(expected).toLocaleLowerCase(),
		)
	}
	return String(value ?? "")
		.toLocaleLowerCase()
		.includes(String(expected ?? "").toLocaleLowerCase())
}

function matchesFilter(row: DatabaseRow, filter: DatabaseFilter): boolean {
	const value = row.properties[filter.propertyKey]
	if (filter.operator === "is-empty") return isEmptyPropertyValue(value)
	if (filter.operator === "is-not-empty") return !isEmptyPropertyValue(value)
	if (filter.operator === "equals") return value === filter.value
	if (filter.operator === "not-equals") return value !== filter.value
	if (filter.operator === "contains") return matchesContains(value, filter.value)
	if (filter.operator === "not-contains") return !matchesContains(value, filter.value)
	if (filter.operator === "greater-than") return compareValues(value, filter.value) > 0
	if (filter.operator === "less-than") return compareValues(value, filter.value) < 0
	if (filter.operator === "on-or-before") return compareValues(value, filter.value) <= 0
	if (filter.operator === "on-or-after") return compareValues(value, filter.value) >= 0
	return true
}

function sortRows(rows: DatabaseRow[], sorts: DatabaseSort[]): DatabaseRow[] {
	if (sorts.length === 0) {
		return [...rows].sort((left, right) => left.title.localeCompare(right.title))
	}
	return [...rows].sort((left, right) => {
		for (const sort of sorts) {
			const direction = sort.direction === "desc" ? -1 : 1
			const comparison = compareValues(getSortValue(left, sort), getSortValue(right, sort))
			if (comparison !== 0) return comparison * direction
		}
		return left.title.localeCompare(right.title)
	})
}

function buildBoardGroups(
	rows: DatabaseRow[],
	view: DatabaseViewDefinition,
	schema: VaultSchema,
): DatabaseBoardGroup[] {
	if (view.layout !== "board" || !view.groupByPropertyKey) return []
	const definition = schema.properties.find((property) => property.key === view.groupByPropertyKey)
	const type = definition ? getPropertyType(definition.type) : undefined
	const groups: DatabaseBoardGroup[] =
		definition && type?.baseType === "select"
			? (definition.options ?? []).map((option) => ({
					id: option.id,
					label: option.label,
					optionId: option.id,
					rows: [],
				}))
			: []
	const ungrouped: DatabaseBoardGroup = {
		id: "__empty__",
		label: "No value",
		optionId: null,
		rows: [],
	}
	const groupsById = new Map(groups.map((group) => [group.id, group]))
	for (const row of rows) {
		const value = row.properties[view.groupByPropertyKey]
		const group = typeof value === "string" ? groupsById.get(value) : undefined
		if (group) group.rows.push(row)
		else ungrouped.rows.push(row)
	}
	if (ungrouped.rows.length > 0 || groups.length === 0) groups.push(ungrouped)
	if (definition && type?.baseType === "select") {
		for (const group of groups) {
			if (group.optionId) {
				group.label = resolvePropertyOption(definition, group.optionId).label
			}
		}
	}
	return groups
}

export function queryDatabaseView(options: {
	index: DatabaseIndex
	database: DatabaseDefinition
	view: DatabaseViewDefinition
	schema: VaultSchema
}): DatabaseQueryResult {
	const rows = sortRows(
		Object.values(options.index.rowsByPath)
			.filter((row) => matchesDatabase(options.database, row))
			.filter((row) => options.view.filters.every((filter) => matchesFilter(row, filter))),
		options.view.sorts,
	)
	return {
		database: options.database,
		view: options.view,
		rows,
		boardGroups: buildBoardGroups(rows, options.view, options.schema),
	}
}
