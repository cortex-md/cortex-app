import { getDatabasesRuntime } from "./runtime"
import type {
	CreateDatabaseInput,
	CreateDatabaseViewInput,
	DatabaseCatalog,
	DatabaseDefinition,
	DatabaseFilter,
	DatabaseLayout,
	DatabaseSort,
	DatabaseSource,
	DatabaseViewDefinition,
} from "./types"
import { getDatabaseCatalogPath } from "./paths"

function createEmptyCatalog(updatedAt = new Date(0).toISOString()): DatabaseCatalog {
	return {
		version: 1,
		databases: {},
		views: {},
		updatedAt,
	}
}

function isMissingFileError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error)
	return /not found|no such file|os error 2|directory does not exist|file does not exist|path does not exist/i.test(
		message,
	)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function normalizeString(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function normalizeTimestamp(value: unknown, fallback: string): string {
	if (typeof value !== "string") return fallback
	const timestamp = Date.parse(value)
	return Number.isNaN(timestamp) ? fallback : value
}

function normalizeSource(value: unknown): DatabaseSource {
	if (!isRecord(value)) return { kind: "vault" }
	if (value.kind === "folder") {
		return { kind: "folder", path: normalizeRelativePath(value.path) }
	}
	if (value.kind === "tag") {
		const tag = normalizeString(value.tag, "")
		return tag ? { kind: "tag", tag } : { kind: "vault" }
	}
	return { kind: "vault" }
}

function normalizeRelativePath(value: unknown): string {
	if (typeof value !== "string") return ""
	return value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "")
}

function normalizeLayout(value: unknown): DatabaseLayout {
	return value === "board" ? "board" : "table"
}

function normalizeFilters(value: unknown): DatabaseFilter[] {
	if (!Array.isArray(value)) return []
	return value.flatMap((filter) => {
		if (!isRecord(filter)) return []
		const propertyKey = normalizeString(filter.propertyKey, "")
		if (!propertyKey) return []
		const operator = normalizeString(filter.operator, "equals") as DatabaseFilter["operator"]
		if (
			![
				"is-empty",
				"is-not-empty",
				"equals",
				"not-equals",
				"contains",
				"not-contains",
				"greater-than",
				"less-than",
				"on-or-before",
				"on-or-after",
			].includes(operator)
		) {
			return []
		}
		return [
			{
				id: normalizeString(filter.id, getRuntimeId()),
				propertyKey,
				operator,
				value: filter.value,
			},
		]
	})
}

function normalizeSorts(value: unknown): DatabaseSort[] {
	if (!Array.isArray(value)) return []
	return value.flatMap((sort) => {
		if (!isRecord(sort)) return []
		const target = normalizeString(sort.target, "title") as DatabaseSort["target"]
		if (!["title", "path", "updatedAt", "createdAt", "property"].includes(target)) return []
		const propertyKey =
			target === "property" ? normalizeString(sort.propertyKey, "") : undefined
		if (target === "property" && !propertyKey) return []
		return [
			{
				id: normalizeString(sort.id, getRuntimeId()),
				target,
				direction: sort.direction === "desc" ? "desc" : "asc",
				propertyKey,
			},
		]
	})
}

function normalizePropertyKeys(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return Array.from(
		new Set(value.flatMap((key) => (typeof key === "string" && key.trim() ? [key.trim()] : []))),
	)
}

function normalizeNullableRelativePath(value: unknown): string | null {
	const path = normalizeRelativePath(value)
	return path ? path : null
}

function getRuntimeNow(): string {
	return (getDatabasesRuntime().now?.() ?? new Date()).toISOString()
}

function getRuntimeId(): string {
	return getDatabasesRuntime().createId?.() ?? crypto.randomUUID()
}

function normalizeDatabase(
	id: string,
	value: unknown,
	now: string,
): DatabaseDefinition | null {
	if (!isRecord(value)) return null
	const databaseId = normalizeString(value.id, id)
	const defaultViewId = normalizeString(value.defaultViewId, "")
	if (!databaseId || !defaultViewId) return null
	const legacySource = normalizeSource(value.source)
	const defaultFolder = normalizeRelativePath(value.defaultFolder)
	return {
		id: databaseId,
		name: normalizeString(value.name, "Database"),
		icon: typeof value.icon === "string" && value.icon.trim() ? value.icon.trim() : null,
		defaultViewId,
		propertyKeys: normalizePropertyKeys(value.propertyKeys),
		defaultFolder:
			defaultFolder || (legacySource.kind === "folder" ? legacySource.path : ""),
		createdInNotePath: normalizeNullableRelativePath(value.createdInNotePath),
		createdAt: normalizeTimestamp(value.createdAt, now),
		updatedAt: normalizeTimestamp(value.updatedAt, now),
	}
}

function normalizeView(
	id: string,
	value: unknown,
	databases: Record<string, DatabaseDefinition>,
	now: string,
): DatabaseViewDefinition | null {
	if (!isRecord(value)) return null
	const viewId = normalizeString(value.id, id)
	const databaseId = normalizeString(value.databaseId, "")
	if (!viewId || !databases[databaseId]) return null
	const groupByPropertyKey =
		typeof value.groupByPropertyKey === "string" && value.groupByPropertyKey.trim()
			? value.groupByPropertyKey.trim()
			: undefined
	return {
		id: viewId,
		databaseId,
		name: normalizeString(value.name, "View"),
		layout: normalizeLayout(value.layout),
		filters: normalizeFilters(value.filters),
		sorts: normalizeSorts(value.sorts),
		visiblePropertyKeys: normalizePropertyKeys(value.visiblePropertyKeys),
		groupByPropertyKey,
		createdAt: normalizeTimestamp(value.createdAt, now),
		updatedAt: normalizeTimestamp(value.updatedAt, now),
	}
}

export function normalizeDatabaseCatalog(value: unknown): DatabaseCatalog {
	const now = getRuntimeNow()
	if (!isRecord(value) || value.version !== 1) return createEmptyCatalog(now)
	const databases: Record<string, DatabaseDefinition> = {}
	if (isRecord(value.databases)) {
		for (const [id, database] of Object.entries(value.databases)) {
			const normalized = normalizeDatabase(id, database, now)
			if (normalized) databases[normalized.id] = normalized
		}
	}
	const views: Record<string, DatabaseViewDefinition> = {}
	if (isRecord(value.views)) {
		for (const [id, view] of Object.entries(value.views)) {
			const normalized = normalizeView(id, view, databases, now)
			if (normalized) views[normalized.id] = normalized
		}
	}
	for (const database of Object.values(databases)) {
		if (!views[database.defaultViewId]) {
			delete databases[database.id]
		}
	}
	return {
		version: 1,
		databases,
		views,
		updatedAt: normalizeTimestamp(value.updatedAt, now),
	}
}

export async function getDatabaseCatalog(vaultPath: string): Promise<DatabaseCatalog> {
	const runtime = getDatabasesRuntime()
	try {
		const raw = await runtime.files.readFile(getDatabaseCatalogPath(vaultPath))
		return normalizeDatabaseCatalog(JSON.parse(raw) as unknown)
	} catch (error) {
		if (isMissingFileError(error)) return createEmptyCatalog(getRuntimeNow())
		throw error
	}
}

export async function updateDatabaseCatalog(
	vaultPath: string,
	catalog: DatabaseCatalog,
): Promise<DatabaseCatalog> {
	const runtime = getDatabasesRuntime()
	const validated = normalizeDatabaseCatalog(catalog)
	await runtime.files.atomicWriteFile(
		getDatabaseCatalogPath(vaultPath),
		JSON.stringify(validated, null, "\t"),
	)
	return validated
}

export function createDatabaseCatalogEntry(input: CreateDatabaseInput): {
	database: DatabaseDefinition
	view: DatabaseViewDefinition
} {
	const now = getRuntimeNow()
	const databaseId = getRuntimeId()
	const viewId = getRuntimeId()
	const viewName = input.layout === "board" ? "Board" : "Table"
	const defaultFolder =
		input.defaultFolder ?? (input.source?.kind === "folder" ? input.source.path : "")
	const propertyKeys = Array.from(
		new Set([
			...(input.propertyKeys ?? []),
			...(input.visiblePropertyKeys ?? []),
			...(input.groupByPropertyKey ? [input.groupByPropertyKey] : []),
		]),
	)
	return {
		database: {
			id: databaseId,
			name: input.name.trim() || "Database",
			icon: input.icon ?? null,
			defaultViewId: viewId,
			propertyKeys,
			defaultFolder: normalizeRelativePath(defaultFolder),
			createdInNotePath: normalizeNullableRelativePath(input.createdInNotePath),
			createdAt: now,
			updatedAt: now,
		},
		view: {
			id: viewId,
			databaseId,
			name: viewName,
			layout: input.layout,
			filters: [],
			sorts: [],
			visiblePropertyKeys: input.visiblePropertyKeys ?? [],
			groupByPropertyKey: input.groupByPropertyKey,
			createdAt: now,
			updatedAt: now,
		},
	}
}

export function createDatabaseViewDefinition(
	input: CreateDatabaseViewInput,
): DatabaseViewDefinition {
	const now = getRuntimeNow()
	return {
		id: getRuntimeId(),
		databaseId: input.databaseId,
		name: input.name.trim() || (input.layout === "board" ? "Board" : "Table"),
		layout: input.layout,
		filters: [],
		sorts: [],
		visiblePropertyKeys: input.visiblePropertyKeys ?? [],
		groupByPropertyKey: input.groupByPropertyKey,
		createdAt: now,
		updatedAt: now,
	}
}
