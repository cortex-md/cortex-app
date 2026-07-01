import type { VaultSchema } from "@cortex/properties"
import {
	addDatabaseMembershipId,
	buildDatabaseIndex,
	createDatabaseCatalogEntry,
	type DatabaseCatalog,
	type DatabaseFileEntry,
	type DatabasesRuntime,
	getDatabaseCatalog,
	getDatabaseMembershipIds,
	initializeDatabases,
	parseDatabaseEmbedMarker,
	queryDatabaseView,
	removeDatabaseMembershipId,
	resetDatabasesRuntime,
	serializeDatabaseEmbedMarker,
	updateDatabaseCatalog,
} from "."

const vaultPath = "/vault"
const schema: VaultSchema = {
	version: 1,
	properties: [
		{
			id: "status",
			key: "status",
			name: "Status",
			type: "select",
			createdAt: "2026-01-01T00:00:00.000Z",
			options: [
				{ id: "todo", label: "Todo", color: "gray" },
				{ id: "done", label: "Done", color: "green" },
			],
			optionSort: "manual",
		},
	],
}

function createRuntime(files: Record<string, string>): DatabasesRuntime {
	let id = 0
	return {
		files: {
			readFile: async (path) => {
				const content = files[path]
				if (content === undefined) throw new Error(`File does not exist: ${path}`)
				return content
			},
			writeFile: async (path, content) => {
				files[path] = content
			},
			atomicWriteFile: async (path, content) => {
				files[path] = content
			},
		},
		notes: {
			readNote: async (path) => files[path] ?? "",
		},
		now: () => new Date("2026-01-01T00:00:00.000Z"),
		createId: () => `id-${id++}`,
	}
}

beforeEach(() => {
	resetDatabasesRuntime()
})

it("returns an empty catalog when the catalog file is missing", async () => {
	initializeDatabases(createRuntime({}))

	await expect(getDatabaseCatalog(vaultPath)).resolves.toMatchObject({
		version: 1,
		databases: {},
		views: {},
	})
})

it("writes and reads a database catalog", async () => {
	const files: Record<string, string> = {}
	initializeDatabases(createRuntime(files))
	const entry = createDatabaseCatalogEntry({
		name: "Projects",
		source: { kind: "vault" },
		layout: "table",
	})
	const catalog: DatabaseCatalog = {
		version: 1,
		databases: { [entry.database.id]: entry.database },
		views: { [entry.view.id]: entry.view },
		updatedAt: "2026-01-01T00:00:00.000Z",
	}

	await updateDatabaseCatalog(vaultPath, catalog)

	expect(JSON.parse(files["/vault/.cortex/schema/databases.json"] ?? "{}")).toMatchObject({
		version: 1,
		databases: { [entry.database.id]: { name: "Projects" } },
	})
	await expect(getDatabaseCatalog(vaultPath)).resolves.toMatchObject({
		databases: { [entry.database.id]: { name: "Projects" } },
	})
})

it("parses database embed markers and updates membership frontmatter", () => {
	expect(parseDatabaseEmbedMarker("{{database:db_1#view-2}}")).toEqual({
		databaseId: "db_1",
		viewId: "view-2",
	})
	expect(
		serializeDatabaseEmbedMarker({
			databaseId: "db_1",
			viewId: "view-2",
		}),
	).toBe("{{database:db_1#view-2}}")

	const linked = addDatabaseMembershipId("---\nstatus: todo\n---\nBody", "db_1")
	expect(getDatabaseMembershipIds(linked)).toEqual(["db_1"])
	expect(getDatabaseMembershipIds(addDatabaseMembershipId(linked, "db_1"))).toEqual(["db_1"])
	expect(getDatabaseMembershipIds(removeDatabaseMembershipId(linked, "db_1"))).toEqual([])
})

it("indexes changed markdown files and reuses persisted fingerprints", async () => {
	const files: Record<string, string> = {
		"/vault/one.md": "---\nstatus: todo\ntags:\n  - work\n---\n# One",
		"/vault/two.md": "---\nstatus: done\n---\n# Two",
	}
	initializeDatabases(createRuntime(files))
	const entries: DatabaseFileEntry[] = [
		{ path: "/vault/one.md", name: "one.md", isDir: false, size: 32, mtime: 10 },
		{ path: "/vault/two.md", name: "two.md", isDir: false, size: 20, mtime: 20 },
	]

	const first = await buildDatabaseIndex(vaultPath, entries)
	files["/vault/one.md"] = "---\nstatus: done\n---\n# One"
	const second = await buildDatabaseIndex(vaultPath, [
		{ ...entries[0], size: 20, mtime: 30 },
		entries[1],
	])

	expect(first.rowsByPath["one.md"]?.properties.status).toBe("todo")
	expect(second.rowsByPath["one.md"]?.properties.status).toBe("done")
	expect(second.rowsByPath["two.md"]?.properties.status).toBe("done")
})

it("queries rows by database membership, sort, and board grouping", async () => {
	const files: Record<string, string> = {}
	initializeDatabases(createRuntime(files))
	const entry = createDatabaseCatalogEntry({
		name: "Projects",
		source: { kind: "folder", path: "projects" },
		layout: "board",
		groupByPropertyKey: "status",
	})
	files["/vault/projects/one.md"] =
		`---\ncortex-databases:\n  - ${entry.database.id}\nstatus: todo\n---\n# One`
	files["/vault/projects/two.md"] =
		`---\ncortex-databases:\n  - ${entry.database.id}\nstatus: done\n---\n# Two`
	files["/vault/projects/unlinked.md"] = "---\nstatus: todo\n---\n# Unlinked"
	files["/vault/archive/old.md"] = "---\nstatus: todo\n---\n# Old"
	const index = await buildDatabaseIndex(vaultPath, [
		{ path: "/vault/projects/one.md", name: "one.md", isDir: false, size: 20, mtime: 10 },
		{ path: "/vault/projects/two.md", name: "two.md", isDir: false, size: 20, mtime: 20 },
		{
			path: "/vault/projects/unlinked.md",
			name: "unlinked.md",
			isDir: false,
			size: 20,
			mtime: 30,
		},
		{ path: "/vault/archive/old.md", name: "old.md", isDir: false, size: 20, mtime: 40 },
	])
	const result = queryDatabaseView({
		index,
		database: entry.database,
		view: entry.view,
		schema,
	})

	expect(result.rows.map((row) => row.relativePath)).toEqual(["projects/one.md", "projects/two.md"])
	expect(result.boardGroups.find((group) => group.id === "todo")?.rows).toHaveLength(1)
	expect(result.boardGroups.find((group) => group.id === "done")?.rows).toHaveLength(1)
})
