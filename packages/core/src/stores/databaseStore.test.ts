import {
	type DatabasesRuntime,
	initializeDatabases,
	resetDatabasesRuntime,
} from "@cortex/databases"
import { getPlatform } from "@cortex/platform"
import {
	initializeProperties,
	type PropertiesRuntime,
	resetPropertiesRuntime,
} from "@cortex/properties"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { noteCache } from "../noteCache"
import { useDatabaseStore } from "./databaseStore"

const vaultPath = "/vault"
const notePath = "/vault/projects/one.md"

interface MemoryRuntime {
	files: Map<string, string>
	readFileSnapshot: ReturnType<typeof vi.fn>
}

function missing(path: string): Error {
	return new Error(`No such file: ${path}`)
}

function createMemoryRuntime(initialFiles: Record<string, string> = {}): MemoryRuntime {
	const files = new Map(Object.entries(initialFiles))
	let id = 0
	const read = async (path: string) => {
		const content = files.get(path)
		if (content === undefined) throw missing(path)
		return content
	}
	const readNote = async (path: string) => noteCache.getEntry(path)?.content ?? read(path)
	const readFileSnapshot = vi.fn(async (path: string) => {
		const content = files.get(path)
		if (content === undefined) throw missing(path)
		return {
			content,
			hash: `hash:${content}`,
			metadata: { createdAt: 1, modifiedAt: content.length },
		}
	})
	const createId = () => `id-${id++}`
	const now = () => new Date("2026-01-01T00:00:00.000Z")
	const databasesRuntime: DatabasesRuntime = {
		files: {
			readFile: read,
			writeFile: async (path, content) => {
				files.set(path, content)
			},
			atomicWriteFile: async (path, content) => {
				files.set(path, content)
			},
		},
		notes: { readNote },
		now,
		createId,
	}
	const propertiesRuntime: PropertiesRuntime = {
		files: {
			readFile: read,
			atomicWriteFile: async (path, content) => {
				files.set(path, content)
			},
		},
		notes: {
			readNote,
			writeNote: async (path, content) => {
				files.set(path, content)
			},
			resolveVaultPath: (path) => (path.startsWith(`${vaultPath}/`) ? vaultPath : null),
			listMarkdownFiles: async (path) =>
				Array.from(files.keys()).filter(
					(filePath) => filePath.startsWith(`${path}/`) && filePath.endsWith(".md"),
				),
		},
		identity: {
			getAuthorContext: async () => ({
				authenticated: false,
				remoteVaultId: null,
				currentUserId: null,
				members: [],
				currentDeviceId: "test-device",
				devices: [{ id: "test-device", label: "Test device", current: true }],
			}),
		},
		metadata: {
			getNoteSourceMetadata: async () => ({
				source: "local",
				synced: false,
				dirty: false,
				createdAt: "2026-01-01T00:00:00.000Z",
				lastEditedAt: "2026-01-01T00:00:00.000Z",
			}),
		},
		now,
		createId,
	}
	initializeDatabases(databasesRuntime)
	initializeProperties(propertiesRuntime)
	vi.mocked(getPlatform).mockReturnValue({
		fs: {
			readFileSnapshot,
		},
	} as never)
	return { files, readFileSnapshot }
}

beforeEach(() => {
	noteCache.clear()
	resetDatabasesRuntime()
	resetPropertiesRuntime()
	useDatabaseStore.getState().reset()
	vi.clearAllMocks()
})

afterEach(() => {
	noteCache.clear()
	resetDatabasesRuntime()
	resetPropertiesRuntime()
	useDatabaseStore.getState().reset()
})

describe("database store", () => {
	it("creates syncable databases and board status schema", async () => {
		const { files } = createMemoryRuntime()
		const status = await useDatabaseStore.getState().ensureBoardStatusProperty(vaultPath)
		const entry = await useDatabaseStore.getState().createDatabase(vaultPath, {
			name: "Projects",
			source: { kind: "folder", path: "projects" },
			layout: "board",
			groupByPropertyKey: status.key,
			visiblePropertyKeys: [status.key],
		})

		expect(entry.database.name).toBe("Projects")
		expect(JSON.parse(files.get("/vault/.cortex/schema/properties.json") ?? "{}")).toMatchObject({
			properties: [{ name: "Status", type: "select" }],
		})
		expect(JSON.parse(files.get("/vault/.cortex/schema/databases.json") ?? "{}")).toMatchObject({
			databases: { [entry.database.id]: { name: "Projects" } },
			views: { [entry.view.id]: { layout: "board", groupByPropertyKey: status.key } },
		})
	})

	it("indexes from NoteCache when a note is already open", async () => {
		createMemoryRuntime({
			[notePath]: "---\nstatus: todo\n---\nBody",
		})
		await useDatabaseStore
			.getState()
			.buildIndexFromFiles(
				vaultPath,
				[{ path: notePath, name: "one.md", isDir: false, size: 24, mtime: 24 }],
				true,
			)

		await noteCache.readEntry(notePath)
		noteCache.write(notePath, "---\nstatus: doing\n---\nBody")
		await useDatabaseStore.getState().indexFile(vaultPath, notePath)

		expect(
			useDatabaseStore.getState().index?.rowsByPath["projects/one.md"]?.properties.status,
		).toBe("doing")
	})

	it("links notes to databases through hidden membership frontmatter", async () => {
		const { files } = createMemoryRuntime({
			[notePath]: "---\npriority: 2\n---\nBody",
		})
		const entry = await useDatabaseStore.getState().createDatabase(vaultPath, {
			name: "Projects",
			layout: "table",
			defaultFolder: "projects",
			visiblePropertyKeys: ["priority"],
			propertyKeys: ["priority"],
		})
		await useDatabaseStore
			.getState()
			.buildIndexFromFiles(
				vaultPath,
				[{ path: notePath, name: "one.md", isDir: false, size: 24, mtime: 24 }],
				true,
			)

		await useDatabaseStore.getState().linkNoteToDatabase(vaultPath, notePath, entry.database.id)
		const result = await useDatabaseStore
			.getState()
			.queryView(vaultPath, entry.database.id, entry.view.id)

		expect(files.get(notePath)).toContain("cortex-databases:")
		expect(result?.rows.map((row) => row.relativePath)).toEqual(["projects/one.md"])
	})

	it("removes and renames indexed markdown paths", async () => {
		createMemoryRuntime({
			[notePath]: "---\nstatus: todo\n---\nBody",
		})
		await useDatabaseStore
			.getState()
			.buildIndexFromFiles(
				vaultPath,
				[{ path: notePath, name: "one.md", isDir: false, size: 24, mtime: 24 }],
				true,
			)

		useDatabaseStore.getState().renameFileInIndex(notePath, "/vault/projects/two.md")
		expect(useDatabaseStore.getState().index?.rowsByPath["projects/two.md"]?.title).toBe("two")

		useDatabaseStore.getState().removeFileFromIndex("/vault/projects/two.md")
		expect(useDatabaseStore.getState().index?.rowsByPath["projects/two.md"]).toBeUndefined()
	})

	it("does not publish stale database indexes after cancellation", async () => {
		let resolveRead: (content: string) => void = () => {}
		let markReadStarted: () => void = () => {}
		const readStarted = new Promise<void>((resolve) => {
			markReadStarted = resolve
		})
		const files = new Map([[notePath, "---\nstatus: todo\n---\nBody"]])
		initializeDatabases({
			files: {
				readFile: async (path) => {
					const content = files.get(path)
					if (content === undefined) throw missing(path)
					return content
				},
				writeFile: async (path, content) => {
					files.set(path, content)
				},
				atomicWriteFile: async (path, content) => {
					files.set(path, content)
				},
			},
			notes: {
				readNote: async () => {
					markReadStarted()
					return new Promise<string>((resolve) => {
						resolveRead = resolve
					})
				},
			},
			now: () => new Date("2026-01-01T00:00:00.000Z"),
			createId: () => "id",
		})

		const indexing = useDatabaseStore
			.getState()
			.buildIndexFromFiles(
				vaultPath,
				[{ path: notePath, name: "one.md", isDir: false, size: 24, mtime: 24 }],
				true,
			)
		await readStarted
		useDatabaseStore.getState().cancelIndexing()
		resolveRead("---\nstatus: done\n---\nBody")
		await indexing

		expect(useDatabaseStore.getState().index).toBeNull()
		expect(useDatabaseStore.getState().indexing).toBe(false)
	})
})
