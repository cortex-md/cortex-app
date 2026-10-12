import { locateFrontmatter, projectRawNote } from "../frontmatter"
import type { PropertyMap } from "../types"
import {
	DATABASE_CONFIG_KEY,
	DATABASE_CONFIG_VERSION,
	DATABASE_FILTER_OPERATORS,
	DATABASE_VIEW_TYPES,
	type DatabaseConfig,
	type DatabaseFilter,
	type DatabaseFilterOperator,
	type DatabaseRowTemplate,
	type DatabaseSort,
	type DatabaseView,
	type DatabaseViewType,
} from "./types"

export interface NormalizedDatabaseConfig {
	config: DatabaseConfig
	error: string | null
}

export interface DatabaseNoteDetection extends NormalizedDatabaseConfig {
	isDatabase: boolean
	body: string
}

const VIEW_NAMES: Record<DatabaseViewType, string> = {
	table: "Table",
	board: "Board",
	calendar: "Calendar",
	gallery: "Gallery",
}

const DATABASE_KEY_LINE = new RegExp(`^${DATABASE_CONFIG_KEY}\\s*:`, "m")

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function readStringList(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined
	const list = [...new Set(value.map(readString).filter((item): item is string => !!item))]
	return list.length ? list : undefined
}

function isViewType(value: unknown): value is DatabaseViewType {
	return (DATABASE_VIEW_TYPES as readonly unknown[]).includes(value)
}

function isFilterOperator(value: unknown): value is DatabaseFilterOperator {
	return (DATABASE_FILTER_OPERATORS as readonly unknown[]).includes(value)
}

function normalizeFilters(value: unknown): DatabaseFilter[] | undefined {
	if (!Array.isArray(value)) return undefined
	const filters = value.flatMap((item): DatabaseFilter[] => {
		if (!isRecord(item)) return []
		const key = readString(item.key)
		if (!key || !isFilterOperator(item.op)) return []
		return item.value === undefined || item.value === null
			? [{ key, op: item.op }]
			: [{ key, op: item.op, value: item.value }]
	})
	return filters.length ? filters : undefined
}

function normalizeSort(value: unknown): DatabaseSort[] | undefined {
	if (!Array.isArray(value)) return undefined
	const sort = value.flatMap((item): DatabaseSort[] => {
		if (!isRecord(item)) return []
		const key = readString(item.key)
		if (!key) return []
		return [{ key, dir: item.dir === "desc" ? "desc" : "asc" }]
	})
	return sort.length ? sort : undefined
}

function normalizeView(value: unknown): DatabaseView | null {
	if (!isRecord(value) || !isViewType(value.type)) return null
	const id = readString(value.id)
	if (!id) return null
	const view: DatabaseView = {
		id,
		type: value.type,
		name: readString(value.name) ?? VIEW_NAMES[value.type],
	}
	const group = readString(value.group)
	const date = readString(value.date)
	const cover = readString(value.cover)
	const columns = readStringList(value.columns)
	const filters = normalizeFilters(value.filters)
	const sort = normalizeSort(value.sort)
	const order = readStringList(value.order)
	if (group) view.group = group
	if (date) view.date = date
	if (cover) view.cover = cover
	if (columns) view.columns = columns
	if (filters) view.filters = filters
	if (sort) view.sort = sort
	if (order) view.order = order
	return view
}

function normalizeTemplate(value: unknown): DatabaseRowTemplate | null {
	if (!isRecord(value)) return null
	const id = readString(value.id)
	const name = readString(value.name)
	if (!id || !name) return null
	const template: DatabaseRowTemplate = { id, name }
	if (isRecord(value.properties) && Object.keys(value.properties).length) {
		template.properties = { ...value.properties }
	}
	if (typeof value.body === "string" && value.body) template.body = value.body
	return template
}

export function createDatabaseView(
	type: DatabaseViewType,
	existing: readonly DatabaseView[] = [],
	overrides: Partial<Omit<DatabaseView, "id" | "type">> = {},
): DatabaseView {
	return {
		id: createDatabaseViewId(type, existing),
		type,
		name: overrides.name ?? VIEW_NAMES[type],
		...overrides,
	}
}

export function createDatabaseViewId(
	type: DatabaseViewType,
	existing: readonly DatabaseView[],
): string {
	const ids = new Set(existing.map((view) => view.id))
	if (!ids.has(type)) return type
	let suffix = 2
	while (ids.has(`${type}-${suffix}`)) suffix++
	return `${type}-${suffix}`
}

export function createDefaultDatabaseConfig(): DatabaseConfig {
	return { version: DATABASE_CONFIG_VERSION, views: [createDatabaseView("table")] }
}

export function normalizeDatabaseConfig(value: unknown): NormalizedDatabaseConfig {
	if (!isRecord(value)) {
		return {
			config: createDefaultDatabaseConfig(),
			error: value === undefined || value === null ? null : "Database settings are not a mapping",
		}
	}
	const seen = new Set<string>()
	const views = (Array.isArray(value.views) ? value.views : [])
		.map(normalizeView)
		.filter((view): view is DatabaseView => {
			if (!view || seen.has(view.id)) return false
			seen.add(view.id)
			return true
		})
	const templates = (Array.isArray(value.templates) ? value.templates : [])
		.map(normalizeTemplate)
		.filter((template): template is DatabaseRowTemplate => !!template)
	const config: DatabaseConfig = {
		version: DATABASE_CONFIG_VERSION,
		views: views.length ? views : createDefaultDatabaseConfig().views,
	}
	if (templates.length) config.templates = templates
	const error =
		value.version !== undefined && value.version !== DATABASE_CONFIG_VERSION
			? `Unsupported database version ${String(value.version)}`
			: null
	return { config, error }
}

function serializeView(view: DatabaseView): PropertyMap {
	const output: PropertyMap = { id: view.id, type: view.type, name: view.name }
	if (view.group) output.group = view.group
	if (view.date) output.date = view.date
	if (view.cover) output.cover = view.cover
	if (view.columns?.length) output.columns = [...view.columns]
	if (view.filters?.length) {
		output.filters = view.filters.map((filter) =>
			filter.value === undefined
				? { key: filter.key, op: filter.op }
				: { key: filter.key, op: filter.op, value: filter.value },
		)
	}
	if (view.sort?.length) output.sort = view.sort.map((sort) => ({ key: sort.key, dir: sort.dir }))
	if (view.order?.length) output.order = [...view.order]
	return output
}

function serializeTemplate(template: DatabaseRowTemplate): PropertyMap {
	const output: PropertyMap = { id: template.id, name: template.name }
	if (template.properties && Object.keys(template.properties).length) {
		output.properties = { ...template.properties }
	}
	if (template.body) output.body = template.body
	return output
}

export function serializeDatabaseConfig(config: DatabaseConfig): PropertyMap {
	const output: PropertyMap = {
		version: DATABASE_CONFIG_VERSION,
		views: config.views.map(serializeView),
	}
	if (config.templates?.length) output.templates = config.templates.map(serializeTemplate)
	return output
}

export function detectDatabaseNote(raw: string): DatabaseNoteDetection {
	const projection = projectRawNote(raw)
	if (projection.frontmatterError) {
		const yaml = locateFrontmatter(raw)?.yaml ?? ""
		return {
			isDatabase: DATABASE_KEY_LINE.test(yaml),
			config: createDefaultDatabaseConfig(),
			error: "Database settings could not be read",
			body: projection.body,
		}
	}
	if (!Object.hasOwn(projection.meta, DATABASE_CONFIG_KEY)) {
		return {
			isDatabase: false,
			config: createDefaultDatabaseConfig(),
			error: null,
			body: projection.body,
		}
	}
	return {
		isDatabase: true,
		...normalizeDatabaseConfig(projection.meta[DATABASE_CONFIG_KEY]),
		body: projection.body,
	}
}

export function renameDatabaseOrderEntry(
	config: DatabaseConfig,
	from: string,
	to: string,
): DatabaseConfig {
	let changed = false
	const views = config.views.map((view) => {
		if (!view.order?.includes(from)) return view
		changed = true
		return { ...view, order: view.order.map((title) => (title === from ? to : title)) }
	})
	return changed ? { ...config, views } : config
}
