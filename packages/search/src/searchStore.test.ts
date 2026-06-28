import { getPlatform } from "@cortex/platform"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SearchEngine } from "./searchEngine"
import { useSearchStore } from "./searchStore"

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(),
}))

beforeEach(() => {
	useSearchStore.getState().reset()
	vi.clearAllMocks()
})

afterEach(() => {
	useSearchStore.getState().reset()
})

describe("search store", () => {
	it("bounds concurrent markdown reads while indexing a vault", async () => {
		let activeReads = 0
		let maxActiveReads = 0
		const readFile = vi.fn(async (path: string) => {
			if (path.endsWith(".cortex/search-index.json")) throw new Error("No index")
			activeReads++
			maxActiveReads = Math.max(maxActiveReads, activeReads)
			await Promise.resolve()
			activeReads--
			return `# ${path}\nBody`
		})
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile,
				writeFile: vi.fn().mockResolvedValue(undefined),
			},
		} as never)
		const files = Array.from({ length: 12 }, (_, index) => ({
			path: `/vault/note-${index}.md`,
			name: `note-${index}.md`,
			isDir: false,
		}))

		await useSearchStore.getState().indexVault("/vault", files)

		expect(maxActiveReads).toBeLessThanOrEqual(4)
		expect(useSearchStore.getState().documentCount).toBe(12)
	})

	it("clears stale documents when indexing a different vault", async () => {
		const filesByPath = new Map([
			["/vault-a/old.md", "# Old\noldneedle"],
			["/vault-b/new.md", "# New\nnewneedle"],
		])
		const readFile = vi.fn(async (path: string) => {
			if (path.endsWith(".cortex/search-index.json")) throw new Error("No index")
			const content = filesByPath.get(path)
			if (!content) throw new Error(`Missing ${path}`)
			return content
		})
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile,
				writeFile: vi.fn().mockResolvedValue(undefined),
			},
		} as never)

		await useSearchStore
			.getState()
			.indexVault("/vault-a", [{ path: "/vault-a/old.md", name: "old.md", isDir: false }])
		useSearchStore.getState().search("oldneedle")
		expect(useSearchStore.getState().results).toHaveLength(1)

		await useSearchStore
			.getState()
			.indexVault("/vault-b", [{ path: "/vault-b/new.md", name: "new.md", isDir: false }])
		useSearchStore.getState().search("oldneedle")
		expect(useSearchStore.getState().results).toEqual([])

		useSearchStore.getState().search("newneedle")
		expect(useSearchStore.getState().results[0]?.id).toBe("new.md")
		expect(useSearchStore.getState().documentCount).toBe(1)
	})

	it("reuses unchanged documents from the persisted index", async () => {
		const persistedEngine = new SearchEngine()
		persistedEngine.addDocument("note.md", "note", "cachedneedle", "", 10)
		const persistedIndex = JSON.stringify({
			version: 1,
			engine: JSON.parse(persistedEngine.serialize()),
			documents: {
				"note.md": { mtime: 10, size: 20 },
			},
		})
		const readFile = vi.fn(async (path: string) => {
			if (path.endsWith(".cortex/search-index.json")) return persistedIndex
			throw new Error(`Unexpected note read: ${path}`)
		})
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile,
				writeFile: vi.fn().mockResolvedValue(undefined),
			},
		} as never)

		await useSearchStore.getState().indexVault("/vault", [
			{
				path: "/vault/note.md",
				name: "note.md",
				isDir: false,
				mtime: 10,
				size: 20,
			},
		])

		expect(readFile).toHaveBeenCalledTimes(1)
		useSearchStore.getState().search("cachedneedle")
		expect(useSearchStore.getState().results[0]?.id).toBe("note.md")
		expect(useSearchStore.getState().documentCount).toBe(1)
	})

	it("does not publish stale vault indexing after cancellation", async () => {
		let resolveNoteRead: (content: string) => void = () => {}
		let markNoteReadStarted: () => void = () => {}
		const noteReadStarted = new Promise<void>((resolve) => {
			markNoteReadStarted = resolve
		})
		const readFile = vi.fn((path: string) => {
			if (path.endsWith(".cortex/search-index.json")) return Promise.reject(new Error("No index"))
			markNoteReadStarted()
			return new Promise<string>((resolve) => {
				resolveNoteRead = resolve
			})
		})
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile,
				writeFile: vi.fn().mockResolvedValue(undefined),
			},
		} as never)

		const indexing = useSearchStore.getState().indexVault("/vault", [
			{
				path: "/vault/note.md",
				name: "note.md",
				isDir: false,
				mtime: 10,
				size: 20,
			},
		])
		await noteReadStarted
		useSearchStore.getState().cancelIndexing()
		resolveNoteRead("# Note\nstale-needle")
		await indexing

		useSearchStore.getState().search("stale-needle")
		expect(useSearchStore.getState().results).toEqual([])
		expect(useSearchStore.getState().documentCount).toBe(0)
		expect(useSearchStore.getState().indexing).toBe(false)
	})
})
