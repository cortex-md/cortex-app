import { afterEach, describe, expect, it } from "vitest"
import { getStateFile, resetStateFiles } from "../stateFile"
import { readOrCreateVaultFile, type VaultTextIo } from "../vault"
import { getVaultSyncState } from "../vaultState"

class NotFound extends Error {}

function createDisk(initial: Record<string, string> = {}) {
	const files = new Map(Object.entries(initial))
	const writes: string[] = []
	const io: VaultTextIo & {
		readFile(path: string): Promise<string>
		atomicWriteFile(path: string, content: string): Promise<void>
	} = {
		readFile: async (path) => {
			const text = files.get(path)
			if (text === undefined) throw new NotFound(path)
			return text
		},
		readText: async (path) => io.readFile(path),
		atomicWriteFile: async (path, content) => {
			writes.push(path)
			files.set(path, content)
		},
		writeText: async (path, content) => io.atomicWriteFile(path, content),
		isNotFound: (error) => error instanceof NotFound,
		createId: () => "new-id",
	}
	return { files, writes, io }
}

const vault = "/vault"
const json = (value: unknown) => JSON.stringify(value)

afterEach(() => resetStateFiles())

describe("readOrCreateVaultFile", () => {
	it("creates vault.json once and keeps its id", async () => {
		const disk = createDisk()
		expect((await readOrCreateVaultFile(vault, disk.io)).id).toBe("new-id")
		expect(JSON.parse(disk.files.get("/vault/.cortex/vault.json") ?? "")).toMatchObject({
			id: "new-id",
		})
		disk.io.createId = () => "other-id"
		expect((await readOrCreateVaultFile(vault, disk.io)).id).toBe("new-id")
	})

	it("never mints a new id for a corrupt vault.json", async () => {
		await expect(
			readOrCreateVaultFile(vault, createDisk({ "/vault/.cortex/vault.json": "{" }).io),
		).rejects.toThrow()
	})
})

describe("state files", () => {
	it("serializes writes and merges only the sections this realm changed", async () => {
		const disk = createDisk({ "/vault/.cortex/sync.json": json({ config: { a: 1 } }) })
		const sync = getVaultSyncState(vault, () => disk.io)
		await sync.read()
		disk.files.set(
			"/vault/.cortex/sync.json",
			json({ config: { a: 1 }, preferences: { fromOtherRealm: true } }),
		)
		await Promise.all([
			sync.update((state) => ({ ...state, config: { a: 2 } })),
			sync.update((state) => ({ ...state, config: { ...state.config, b: 3 } })),
		])
		expect(JSON.parse(disk.files.get("/vault/.cortex/sync.json") ?? "")).toMatchObject({
			config: { a: 2, b: 3 },
			preferences: { fromOtherRealm: true },
		})
	})

	it("returns one instance per path and debounces writes until flush", async () => {
		const disk = createDisk()
		const options = {
			path: "/vault/.cortex/local-test.json",
			parse: (raw: Record<string, unknown>) => raw as { count?: number },
			empty: () => ({}),
			io: () => disk.io,
			debounceMs: 10_000,
		}
		const file = getStateFile(options)
		expect(getStateFile(options)).toBe(file)
		void file.update(() => ({ count: 1 }))
		void file.update(() => ({ count: 2 }))
		await Promise.resolve()
		expect(disk.writes).toHaveLength(0)
		await file.flush()
		expect(disk.writes).toHaveLength(1)
		expect(JSON.parse(disk.files.get(options.path) ?? "")).toEqual({ count: 2 })
	})
})
