import { setFrontmatterValue } from "../frontmatter"
import type { VaultSchema } from "../types"
import {
	buildDatabaseFromPreset,
	createDatabaseRow,
	DATABASE_CONFIG_KEY,
	DATABASE_NO_VALUE_GROUP,
	detectDatabaseNote,
	getDatabasePreset,
	getDatabaseRowPreset,
	isDatabaseRowPath,
	isDatabaseViewNoteCandidate,
	queryDatabaseView,
	resolveDatabaseProperties,
	serializeDatabaseConfig,
} from "./index"

let nextId = 0
const factory = {
	createId: () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`,
	now: () => new Date("2026-10-11T00:00:00.000Z"),
}
const context = { currentUserId: "user-1", today: "2026-10-11" }

function buildProjects() {
	nextId = 0
	const empty: VaultSchema = { version: 1, properties: [] }
	const built = buildDatabaseFromPreset(empty, getDatabasePreset("projects"), factory)
	const status = built.schema.properties.find((property) => property.key === "status")
	if (!status?.options) throw new Error("status options missing")
	const [backlog, progress, , done] = status.options
	const rows = [
		{ title: "Beta", meta: { status: progress.id, due: "2026-10-20", owner: "user-1" } },
		{ title: "Alpha", meta: { status: done.id, due: "2026-10-05" } },
		{ title: "Gamma", meta: { status: backlog.id } },
		{ title: "Delta", meta: { due: "2026-10-12", owner: "user-2" } },
	].map(({ title, meta }) => {
		let raw = ""
		for (const [key, value] of Object.entries(meta)) raw = setFrontmatterValue(raw, key, value)
		return createDatabaseRow(`/vault/Projects/${title}.md`, raw, { mtime: 1, size: 1 })
	})
	return { built, rows, options: { backlog, progress, done } }
}

describe("database config", () => {
	it("round-trips through frontmatter with stable, line-oriented YAML", () => {
		const { built } = buildProjects()
		const raw = setFrontmatterValue(
			"Description",
			DATABASE_CONFIG_KEY,
			serializeDatabaseConfig(built.config),
		)
		expect(raw).not.toContain("{")
		const detected = detectDatabaseNote(raw)
		expect(detected.isDatabase).toBe(true)
		expect(detected.error).toBeNull()
		expect(detected.config).toEqual(built.config)
		expect(serializeDatabaseConfig(detected.config)).toEqual(serializeDatabaseConfig(built.config))
	})

	it("keeps rows visible when merge conflicts break the settings block", () => {
		const raw = "---\ndatabase:\n<<<<<<< LOCAL\n  version: 1\n=======\n>>>>>>> REMOTE\n---\n"
		const detected = detectDatabaseNote(raw)
		expect(detected.isDatabase).toBe(true)
		expect(detected.error).not.toBeNull()
		expect(detected.config.views[0]?.type).toBe("table")
	})

	it("reuses existing vault properties instead of duplicating them", () => {
		const { built } = buildProjects()
		const again = buildDatabaseFromPreset(built.schema, getDatabasePreset("projects"), factory)
		expect(again.schemaChanged).toBe(false)
		expect(again.schema.properties).toHaveLength(built.schema.properties.length)
	})

	it("recognises folder notes and rows by path", () => {
		expect(isDatabaseViewNoteCandidate("/vault/Projects/Projects.md")).toBe(true)
		expect(isDatabaseViewNoteCandidate("/vault/Projects/Other.md")).toBe(false)
		expect(isDatabaseRowPath("/vault/Projects/Beta.md", "/vault/Projects")).toBe(true)
		expect(isDatabaseRowPath("/vault/Projects/Projects.md", "/vault/Projects")).toBe(false)
		expect(isDatabaseRowPath("/vault/Projects/Sub/Note.md", "/vault/Projects")).toBe(false)
	})
})

describe("database query", () => {
	it("filters, sorts with empty values last, and groups by select option order", () => {
		const { built, rows, options } = buildProjects()
		const resolved = resolveDatabaseProperties(built.schema, rows, built.config)
		const table = built.config.views[0]
		const result = queryDatabaseView(
			rows,
			{ ...table, filters: [{ key: "status", op: "is_not", value: options.done.id }] },
			resolved,
			context,
		)
		expect(result.rows.map((row) => row.title)).toEqual(["Delta", "Beta", "Gamma"])
		expect(result.groups.map((group) => [group.label, group.rows.length])).toEqual([
			["Backlog", 1],
			["In progress", 1],
			["In review", 0],
			["Done", 0],
			["No value", 1],
		])
		expect(result.matchedCount).toBe(3)
		expect(result.totalCount).toBe(4)
	})

	it("resolves $me and $today tokens from the injected context", () => {
		const { built, rows } = buildProjects()
		const resolved = resolveDatabaseProperties(built.schema, rows, built.config)
		const view = {
			...built.config.views[0],
			group: undefined,
			sort: undefined,
			filters: [
				{ key: "owner", op: "is" as const, value: "$me" },
				{ key: "due", op: "gte" as const, value: "$today" },
			],
		}
		expect(queryDatabaseView(rows, view, resolved, context).rows.map((row) => row.title)).toEqual([
			"Beta",
		])
	})

	it("presets new rows from the clicked group and equality filters", () => {
		const { built, options } = buildProjects()
		const view = {
			...built.config.views[0],
			filters: [{ key: "owner", op: "is" as const, value: "$me" }],
		}
		const group = {
			key: options.progress.id,
			label: "In progress",
			option: options.progress,
			value: options.progress.id,
			rows: [],
		}
		expect(getDatabaseRowPreset(view, group, context)).toEqual({
			owner: "user-1",
			status: options.progress.id,
		})
		expect(
			getDatabaseRowPreset(
				view,
				{ ...group, key: DATABASE_NO_VALUE_GROUP, value: undefined },
				context,
			),
		).toEqual({ owner: "user-1" })
	})
})
