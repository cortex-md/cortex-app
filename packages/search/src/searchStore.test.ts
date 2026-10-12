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
	it("reads changed markdown notes in one batched request while indexing a vault", async () => {
		const readFile = vi.fn(async () => {
			throw new Error("No index")
		})
		const readTextFiles = vi.fn(async (paths: readonly string[]) =>
			paths.map((path) => ({ content: `# ${path}\nBody`, modifiedAt: 0, size: 0 })),
		)
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile,
				readTextFiles,
				writeFile: vi.fn().mockResolvedValue(undefined),
			},
		} as never)
		const files = Array.from({ length: 12 }, (_, index) => ({
			path: `/vault/note-${index}.md`,
			name: `note-${index}.md`,
			isDir: false,
		}))

		await useSearchStore.getState().indexVault("/vault", files)

		expect(readTextFiles).toHaveBeenCalledTimes(1)
		expect(readTextFiles.mock.calls[0]?.[0]).toHaveLength(12)
		expect(useSearchStore.getState().documentCount).toBe(12)
	})

	it("clears stale documents when indexing a different vault", async () => {
		const filesByPath = new Map([
			["/vault-a/old.md", "# Old\noldneedle"],
			["/vault-b/new.md", "# New\nnewneedle"],
		])
		const readFile = vi.fn(async () => {
			throw new Error("No index")
		})
		const readTextFiles = vi.fn(async (paths: readonly string[]) =>
			paths.map((path) => {
				const content = filesByPath.get(path)
				return content === undefined ? null : { content, modifiedAt: 0, size: 0 }
			}),
		)
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile,
				readTextFiles,
				writeFile: vi.fn().mockResolvedValue(undefined),
			},
		} as never)

		await useSearchStore
			.getState()
			.indexVault("/vault-a", [{ path: "/vault-a/old.md", name: "old.md", isDir: false }])
		await useSearchStore.getState().search("oldneedle")
		expect(useSearchStore.getState().results).toHaveLength(1)

		await useSearchStore
			.getState()
			.indexVault("/vault-b", [{ path: "/vault-b/new.md", name: "new.md", isDir: false }])
		await useSearchStore.getState().search("oldneedle")
		expect(useSearchStore.getState().results).toEqual([])

		await useSearchStore.getState().search("newneedle")
		expect(useSearchStore.getState().results[0]?.id).toBe("new.md")
		expect(useSearchStore.getState().documentCount).toBe(1)
	})

	it("reuses unchanged documents from the persisted index", async () => {
		const persistedEngine = new SearchEngine()
		persistedEngine.addDocument("note.md", "note", "cachedneedle", "", 10)
		const persistedIndex = JSON.stringify({
			version: 2,
			engine: persistedEngine.toJSON(),
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
		await useSearchStore.getState().search("cachedneedle")
		expect(useSearchStore.getState().results[0]?.id).toBe("note.md")
		expect(useSearchStore.getState().documentCount).toBe(1)
	})

	it("does not publish stale vault indexing after cancellation", async () => {
		let resolveNoteRead: (content: string) => void = () => {}
		let markNoteReadStarted: () => void = () => {}
		const noteReadStarted = new Promise<void>((resolve) => {
			markNoteReadStarted = resolve
		})
		const readFile = vi.fn(() => Promise.reject(new Error("No index")))
		const readTextFiles = vi.fn(() => {
			markNoteReadStarted()
			return new Promise<{ content: string; modifiedAt: number; size: number }[]>((resolve) => {
				resolveNoteRead = (content) => resolve([{ content, modifiedAt: 10, size: 20 }])
			})
		})
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile,
				readTextFiles,
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

		await useSearchStore.getState().search("stale-needle")
		expect(useSearchStore.getState().results).toEqual([])
		expect(useSearchStore.getState().documentCount).toBe(0)
		expect(useSearchStore.getState().indexing).toBe(false)
	})
})
