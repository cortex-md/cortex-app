import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockReadFile = vi.fn()
const mockReadFileSnapshot = vi.fn()
const mockWriteFile = vi.fn()
const mockHashFile = vi.fn()
const mockGetFileMetadata = vi.fn()

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(() => ({
		fs: {
			readFile: mockReadFile,
			readFileSnapshot: mockReadFileSnapshot,
			writeFile: mockWriteFile,
			hashFile: mockHashFile,
			getFileMetadata: mockGetFileMetadata,
		},
	})),
	initPlatform: vi.fn(),
}))

import { noteCache } from "../noteCache"

const FILE_PATH = "/vault/test.md"

beforeEach(() => {
	mockReadFile.mockResolvedValue("initial content")
	mockReadFileSnapshot.mockResolvedValue({
		content: "initial content",
		hash: "hash-initial",
		metadata: { createdAt: 1, modifiedAt: 2 },
	})
	mockHashFile.mockResolvedValue("hash-initial")
	mockGetFileMetadata.mockResolvedValue({ createdAt: 1, modifiedAt: 3 })
	mockWriteFile.mockResolvedValue(undefined)
	noteCache.clear()
	vi.useFakeTimers()
})

afterEach(() => {
	noteCache.clear()
	vi.useRealTimers()
	vi.clearAllMocks()
})

async function seedEntry(content = "initial content", hash = "hash-initial") {
	mockReadFile.mockResolvedValue(content)
	mockHashFile.mockResolvedValue(hash)
	mockReadFileSnapshot.mockResolvedValue({
		content,
		hash,
		metadata: { createdAt: 1, modifiedAt: 2 },
	})
	return noteCache.read(FILE_PATH)
}

function mockSnapshot(path: string, content: string, hash = `hash:${path}`) {
	mockReadFileSnapshot.mockImplementation(async (requestedPath: string) => {
		if (requestedPath === path) {
			return {
				content,
				hash,
				metadata: { createdAt: 1, modifiedAt: 2 },
			}
		}
		return {
			content: "initial content",
			hash: "hash-initial",
			metadata: { createdAt: 1, modifiedAt: 2 },
		}
	})
}

describe("read()", () => {
	it("reads from disk on first access", async () => {
		mockReadFileSnapshot.mockResolvedValue({
			content: "disk content",
			hash: "hash-disk",
			metadata: { createdAt: 1, modifiedAt: 2 },
		})
		const content = await noteCache.read(FILE_PATH)
		expect(content).toBe("disk content")
		expect(mockReadFileSnapshot).toHaveBeenCalledWith(FILE_PATH)
	})

	it("returns cached content without re-reading disk on second call", async () => {
		await noteCache.read(FILE_PATH)
		mockReadFileSnapshot.mockResolvedValue({
			content: "new disk content",
			hash: "hash-new",
			metadata: { createdAt: 1, modifiedAt: 4 },
		})
		const content = await noteCache.read(FILE_PATH)
		expect(content).toBe("initial content")
		expect(mockReadFileSnapshot).toHaveBeenCalledTimes(1)
	})

	it("creates an entry with dirty: false", async () => {
		await noteCache.read(FILE_PATH)
		expect(noteCache.isDirty(FILE_PATH)).toBe(false)
	})

	it("returns dirty cached content without re-reading disk", async () => {
		await seedEntry()
		noteCache.write(FILE_PATH, "local edit")

		const content = await noteCache.read(FILE_PATH)

		expect(content).toBe("local edit")
		expect(mockReadFileSnapshot).toHaveBeenCalledTimes(1)
	})
})

describe("readEntry()", () => {
	it("returns the loaded cache entry", async () => {
		const entry = await noteCache.readEntry(FILE_PATH)

		expect(entry).toBe(noteCache.getEntry(FILE_PATH))
		expect(entry).toMatchObject({
			filePath: FILE_PATH,
			content: "initial content",
			hash: "hash-initial",
			metadata: { createdAt: 1, modifiedAt: 2 },
		})
	})

	it("shares the openTab preload with readEntry", async () => {
		let releaseSnapshot: ((content: string) => void) | undefined
		const pendingSnapshot = new Promise<{
			content: string
			hash: string
			metadata: { createdAt: number; modifiedAt: number }
		}>((resolve) => {
			releaseSnapshot = (content) =>
				resolve({
					content,
					hash: "hash-loaded",
					metadata: { createdAt: 1, modifiedAt: 2 },
				})
		})
		mockReadFileSnapshot.mockReturnValue(pendingSnapshot)

		noteCache.openTab(FILE_PATH)
		const entry = noteCache.readEntry(FILE_PATH)
		releaseSnapshot?.("loaded content")

		await expect(entry).resolves.toMatchObject({
			content: "loaded content",
			openTabCount: 1,
		})
		expect(mockReadFileSnapshot).toHaveBeenCalledTimes(1)
	})

	it("rejects non-Markdown files before reading from disk", async () => {
		await expect(noteCache.readEntry("/vault/source.pdf")).rejects.toThrow(
			"NoteCache only supports Markdown files",
		)
		expect(mockReadFileSnapshot).not.toHaveBeenCalled()
	})
})

describe("write()", () => {
	it("marks entry as dirty when content differs from disk", async () => {
		await seedEntry()
		noteCache.write(FILE_PATH, "modified content")
		expect(noteCache.isDirty(FILE_PATH)).toBe(true)
	})

	it("does NOT mark dirty when content is same as disk", async () => {
		await seedEntry("initial content")
		noteCache.write(FILE_PATH, "initial content")
		expect(noteCache.isDirty(FILE_PATH)).toBe(false)
	})

	it("does not flush immediately after write", async () => {
		await seedEntry()
		noteCache.write(FILE_PATH, "modified content")
		expect(mockWriteFile).not.toHaveBeenCalled()
	})

	it("schedules auto-save after 2 seconds debounce", async () => {
		await seedEntry()
		noteCache.write(FILE_PATH, "modified content")
		await vi.advanceTimersByTimeAsync(2001)
		expect(mockWriteFile).toHaveBeenCalledWith(FILE_PATH, "modified content")
	})

	it("is a no-op when entry does not exist", () => {
		noteCache.write("/nonexistent.md", "content")
		expect(mockWriteFile).not.toHaveBeenCalled()
	})
})

describe("flush()", () => {
	it("writes dirty content to disk", async () => {
		await seedEntry()
		noteCache.write(FILE_PATH, "modified content")
		await noteCache.flush(FILE_PATH)
		expect(mockWriteFile).toHaveBeenCalledWith(FILE_PATH, "modified content")
	})

	it("marks entry as not dirty after flush", async () => {
		await seedEntry()
		noteCache.write(FILE_PATH, "modified content")
		await noteCache.flush(FILE_PATH)
		expect(noteCache.isDirty(FILE_PATH)).toBe(false)
	})

	it("refreshes metadata after flush", async () => {
		await seedEntry()
		mockGetFileMetadata.mockResolvedValue({ createdAt: 10, modifiedAt: 20 })
		noteCache.write(FILE_PATH, "modified content")

		await noteCache.flush(FILE_PATH)

		expect(noteCache.getEntry(FILE_PATH)?.metadata).toEqual({ createdAt: 10, modifiedAt: 20 })
		expect(noteCache.getEntry(FILE_PATH)?.mtime).toBe(20)
	})

	it("is a no-op when entry is clean", async () => {
		await seedEntry()
		await noteCache.flush(FILE_PATH)
		expect(mockWriteFile).not.toHaveBeenCalled()
	})

	it("is a no-op when entry does not exist", async () => {
		await noteCache.flush("/nonexistent.md")
		expect(mockWriteFile).not.toHaveBeenCalled()
	})

	it("is a no-op for non-Markdown files", async () => {
		await noteCache.flush("/vault/source.pdf")
		expect(mockWriteFile).not.toHaveBeenCalled()
	})
})

describe("flushAll()", () => {
	it("flushes all dirty entries", async () => {
		const fileA = "/vault/a.md"
		const fileB = "/vault/b.md"
		mockReadFile.mockResolvedValue("content")
		mockHashFile.mockResolvedValue("hash")
		await noteCache.read(fileA)
		await noteCache.read(fileB)
		noteCache.write(fileA, "modified A")
		noteCache.write(fileB, "modified B")
		await noteCache.flushAll()
		expect(mockWriteFile).toHaveBeenCalledWith(fileA, "modified A")
		expect(mockWriteFile).toHaveBeenCalledWith(fileB, "modified B")
	})

	it("skips clean entries", async () => {
		await seedEntry()
		await noteCache.flushAll()
		expect(mockWriteFile).not.toHaveBeenCalled()
	})
})

describe("renamePath()", () => {
	it("moves cache state, snapshots, and open tab ownership to the new path", async () => {
		const newPath = "/vault/renamed.md"
		await seedEntry()
		noteCache.openTab(FILE_PATH)
		noteCache.takeSnapshot(FILE_PATH, "manual")

		noteCache.renamePath(FILE_PATH, newPath)

		expect(noteCache.getEntry(FILE_PATH)).toBeUndefined()
		expect(noteCache.getEntry(newPath)).toMatchObject({
			filePath: newPath,
			openTabCount: 1,
		})
		expect(noteCache.getSnapshots(newPath)).toHaveLength(1)
	})

	it("moves a pending save so it cannot write to the old path", async () => {
		const newPath = "/vault/renamed.md"
		await seedEntry()
		noteCache.write(FILE_PATH, "modified content")

		noteCache.renamePath(FILE_PATH, newPath)
		await vi.advanceTimersByTimeAsync(2001)

		expect(mockWriteFile).toHaveBeenCalledWith(newPath, "modified content")
		expect(mockWriteFile).not.toHaveBeenCalledWith(FILE_PATH, "modified content")
	})

	it("moves cached descendants when a folder path changes", async () => {
		const oldPath = "/vault/folder/note.md"
		const newPath = "/vault/archive/note.md"
		mockSnapshot(oldPath, "folder content", "folder-hash")
		await noteCache.read(oldPath)
		noteCache.openTab(oldPath)
		noteCache.write(oldPath, "changed folder content")

		noteCache.renamePath("/vault/folder", "/vault/archive")
		await vi.advanceTimersByTimeAsync(2001)

		expect(noteCache.getEntry(oldPath)).toBeUndefined()
		expect(noteCache.getEntry(newPath)).toMatchObject({
			filePath: newPath,
			openTabCount: 1,
		})
		expect(mockWriteFile).toHaveBeenCalledWith(newPath, "changed folder content")
	})

	it("moves a pending preload when a file path changes", async () => {
		const newPath = "/vault/renamed.md"
		let releaseOldSnapshot: ((content: string) => void) | undefined
		const oldSnapshot = new Promise<{
			content: string
			hash: string
			metadata: { createdAt: number; modifiedAt: number }
		}>((resolve) => {
			releaseOldSnapshot = (content) =>
				resolve({
					content,
					hash: "hash-old",
					metadata: { createdAt: 1, modifiedAt: 2 },
				})
		})
		mockReadFileSnapshot.mockImplementation(async (path: string) => {
			if (path === FILE_PATH) return oldSnapshot
			if (path === newPath) {
				return {
					content: "new path content",
					hash: "hash-new",
					metadata: { createdAt: 1, modifiedAt: 3 },
				}
			}
			throw new Error(`Unexpected path ${path}`)
		})

		noteCache.openTab(FILE_PATH)
		noteCache.renamePath(FILE_PATH, newPath)
		releaseOldSnapshot?.("old path content")
		await oldSnapshot
		await Promise.resolve()

		await expect(noteCache.read(newPath)).resolves.toBe("new path content")
		expect(noteCache.getEntry(FILE_PATH)).toBeUndefined()
		expect(noteCache.getEntry(newPath)).toMatchObject({
			content: "new path content",
			openTabCount: 1,
		})
	})
})

describe("openTab() / closeTab()", () => {
	it("increments openTabCount when file is already in cache", async () => {
		await seedEntry()
		noteCache.openTab(FILE_PATH)
		const entry = noteCache.getEntry(FILE_PATH)
		expect(entry?.openTabCount).toBe(1)
	})

	it("starts a preload when entry does not exist", async () => {
		noteCache.openTab(FILE_PATH)
		await noteCache.read(FILE_PATH)

		expect(mockReadFileSnapshot).toHaveBeenCalledTimes(1)
		expect(noteCache.getEntry(FILE_PATH)?.openTabCount).toBe(1)
	})

	it("does not preload non-Markdown tabs", () => {
		noteCache.openTab("/vault/source.pdf")

		expect(mockReadFileSnapshot).not.toHaveBeenCalled()
		expect(noteCache.getEntry("/vault/source.pdf")).toBeUndefined()
	})

	it("shares the openTab preload with read", async () => {
		let releaseSnapshot: ((content: string) => void) | undefined
		const pendingSnapshot = new Promise<{
			content: string
			hash: string
			metadata: { createdAt: number; modifiedAt: number }
		}>((resolve) => {
			releaseSnapshot = (content) =>
				resolve({
					content,
					hash: "hash-loaded",
					metadata: { createdAt: 1, modifiedAt: 2 },
				})
		})
		mockReadFileSnapshot.mockReturnValue(pendingSnapshot)

		noteCache.openTab(FILE_PATH)
		const content = noteCache.read(FILE_PATH)
		releaseSnapshot?.("loaded content")

		await expect(content).resolves.toBe("loaded content")
		expect(mockReadFileSnapshot).toHaveBeenCalledTimes(1)
	})

	it("does not keep a closed tab count from a pending preload", async () => {
		let releaseSnapshot: ((content: string) => void) | undefined
		const pendingSnapshot = new Promise<{
			content: string
			hash: string
			metadata: { createdAt: number; modifiedAt: number }
		}>((resolve) => {
			releaseSnapshot = (content) =>
				resolve({
					content,
					hash: "hash-loaded",
					metadata: { createdAt: 1, modifiedAt: 2 },
				})
		})
		mockReadFileSnapshot.mockReturnValue(pendingSnapshot)

		noteCache.openTab(FILE_PATH)
		await noteCache.closeTab(FILE_PATH)
		releaseSnapshot?.("loaded content")
		await pendingSnapshot

		await expect(noteCache.read(FILE_PATH)).resolves.toBe("loaded content")
		expect(noteCache.getEntry(FILE_PATH)?.openTabCount).toBe(0)
	})

	it("decrements openTabCount on closeTab", async () => {
		await seedEntry()
		noteCache.openTab(FILE_PATH)
		await noteCache.closeTab(FILE_PATH)
		const entry = noteCache.getEntry(FILE_PATH)
		expect(entry?.openTabCount).toBe(0)
	})

	it("flushes dirty content on closeTab", async () => {
		await seedEntry()
		noteCache.openTab(FILE_PATH)
		noteCache.write(FILE_PATH, "modified content")
		await noteCache.closeTab(FILE_PATH)
		expect(mockWriteFile).toHaveBeenCalledWith(FILE_PATH, "modified content")
	})

	it("does not go below 0 on closeTab", async () => {
		await seedEntry()
		await noteCache.closeTab(FILE_PATH)
		const entry = noteCache.getEntry(FILE_PATH)
		expect(entry?.openTabCount).toBe(0)
	})
})

describe("takeSnapshot()", () => {
	it("creates snapshot with correct trigger and content", async () => {
		await seedEntry("my content")
		const snapshot = noteCache.takeSnapshot(FILE_PATH, "manual")
		expect(snapshot).not.toBeNull()
		expect(snapshot?.trigger).toBe("manual")
		expect(snapshot?.content).toBe("my content")
	})

	it("stores snapshot in entry", async () => {
		await seedEntry()
		noteCache.takeSnapshot(FILE_PATH, "auto")
		expect(noteCache.getSnapshots(FILE_PATH)).toHaveLength(1)
	})

	it("skips duplicate automatic snapshots", async () => {
		await seedEntry("stable content")
		const firstSnapshot = noteCache.takeSnapshot(FILE_PATH, "auto")
		const secondSnapshot = noteCache.takeSnapshot(FILE_PATH, "auto")

		expect(firstSnapshot).not.toBeNull()
		expect(secondSnapshot).toBeNull()
		expect(noteCache.getSnapshots(FILE_PATH)).toHaveLength(1)
	})

	it("keeps duplicate manual snapshots", async () => {
		await seedEntry("stable content")
		noteCache.takeSnapshot(FILE_PATH, "manual")
		noteCache.takeSnapshot(FILE_PATH, "manual")

		expect(noteCache.getSnapshots(FILE_PATH)).toHaveLength(2)
	})

	it("returns null when entry does not exist", () => {
		const snapshot = noteCache.takeSnapshot("/nonexistent.md", "manual")
		expect(snapshot).toBeNull()
	})

	it("evicts oldest snapshot when exceeding 50 snapshots", async () => {
		await seedEntry()
		for (let i = 0; i < 51; i++) {
			noteCache.takeSnapshot(FILE_PATH, "auto")
		}
		expect(noteCache.getSnapshots(FILE_PATH).length).toBeLessThanOrEqual(50)
	})
})

describe("handleExternalChange()", () => {
	it("overwrites clean entry with new content", async () => {
		await seedEntry("old content", "hash-old")
		mockReadFileSnapshot.mockResolvedValue({
			content: "new content",
			hash: "hash-new",
			metadata: { createdAt: 1, modifiedAt: 4 },
		})
		const listener = vi.fn()
		noteCache.onExternalChange(listener)
		await noteCache.handleExternalChange(FILE_PATH, "hash-new")
		expect(noteCache.getEntry(FILE_PATH)?.content).toBe("new content")
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({ filePath: FILE_PATH, kind: "overwrite" }),
		)
	})

	it("emits conflict event for dirty entry", async () => {
		await seedEntry("original", "hash-original")
		noteCache.write(FILE_PATH, "locally modified")
		const listener = vi.fn()
		noteCache.onExternalChange(listener)
		await noteCache.handleExternalChange(FILE_PATH, "hash-remote")
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({ filePath: FILE_PATH, kind: "conflict" }),
		)
	})

	it("is a no-op when hash has not changed", async () => {
		await seedEntry("content", "hash-initial")
		const listener = vi.fn()
		noteCache.onExternalChange(listener)
		await noteCache.handleExternalChange(FILE_PATH, "hash-initial")
		expect(listener).not.toHaveBeenCalled()
	})

	it("coalesces concurrent external events into one disk read", async () => {
		await seedEntry("old content", "hash-old")
		let releaseSnapshot: ((content: string) => void) | undefined
		const pendingSnapshot = new Promise<{
			content: string
			hash: string
			metadata: { createdAt: number; modifiedAt: number }
		}>((resolve) => {
			releaseSnapshot = (content) =>
				resolve({
					content,
					hash: "hash-latest",
					metadata: { createdAt: 1, modifiedAt: 4 },
				})
		})
		mockReadFileSnapshot.mockReturnValue(pendingSnapshot)
		const contentListener = vi.fn()
		noteCache.onContentChange(FILE_PATH, contentListener)

		const first = noteCache.handleExternalChange(FILE_PATH, "hash-first")
		const second = noteCache.handleExternalChange(FILE_PATH, "hash-latest")
		releaseSnapshot?.("latest content")
		await Promise.all([first, second])

		expect(mockReadFileSnapshot).toHaveBeenCalledTimes(2)
		expect(contentListener).toHaveBeenCalledTimes(1)
		expect(noteCache.getEntry(FILE_PATH)?.content).toBe("latest content")
	})

	it("does not publish an external event when only the hash changes", async () => {
		await seedEntry("same content", "hash-old")
		mockReadFileSnapshot.mockResolvedValue({
			content: "same content",
			hash: "hash-new",
			metadata: { createdAt: 1, modifiedAt: 4 },
		})
		const contentListener = vi.fn()
		const externalListener = vi.fn()
		noteCache.onContentChange(FILE_PATH, contentListener)
		noteCache.onExternalChange(externalListener)

		await noteCache.handleExternalChange(FILE_PATH, "hash-new")

		expect(contentListener).not.toHaveBeenCalled()
		expect(externalListener).not.toHaveBeenCalled()
	})

	it("is a no-op when entry does not exist", async () => {
		const listener = vi.fn()
		noteCache.onExternalChange(listener)
		await noteCache.handleExternalChange("/nonexistent.md", "some-hash")
		expect(listener).not.toHaveBeenCalled()
	})
})

describe("writeExternal()", () => {
	it("updates entry content", async () => {
		await seedEntry("original")
		noteCache.writeExternal(FILE_PATH, "externally updated")
		expect(noteCache.getEntry(FILE_PATH)?.content).toBe("externally updated")
	})

	it("notifies content change listeners", async () => {
		await seedEntry()
		const listener = vi.fn()
		noteCache.onContentChange(FILE_PATH, listener)
		noteCache.writeExternal(FILE_PATH, "updated content")
		expect(listener).toHaveBeenCalledWith(FILE_PATH, "updated content")
	})

	it("is a no-op when entry does not exist", () => {
		expect(() => noteCache.writeExternal("/nonexistent.md", "content")).not.toThrow()
	})
})

describe("primeClean()", () => {
	it("seeds a clean entry after a direct filesystem write", () => {
		noteCache.primeClean(FILE_PATH, "---\ncreated: now\n---\nBody", "hash-created", {
			localCreated: true,
		})

		expect(noteCache.getEntry(FILE_PATH)).toMatchObject({
			content: "---\ncreated: now\n---\nBody",
			diskContent: "---\ncreated: now\n---\nBody",
			hash: "hash-created",
			dirty: false,
			localCreatedAt: expect.any(Number),
		})
	})

	it("replaces stale cached content and clears dirty state", async () => {
		await seedEntry("---\nproject: Old\n---\nBody")
		noteCache.write(FILE_PATH, "---\nproject: Edited\n---\nBody")

		noteCache.primeClean(FILE_PATH, "---\ncreated: now\n---\nNew", "hash-new")

		expect(noteCache.getEntry(FILE_PATH)).toMatchObject({
			content: "---\ncreated: now\n---\nNew",
			diskContent: "---\ncreated: now\n---\nNew",
			hash: "hash-new",
			dirty: false,
		})
		await vi.advanceTimersByTimeAsync(2001)
		expect(mockWriteFile).not.toHaveBeenCalled()
	})

	it("clears local creation ownership after an external overwrite", async () => {
		noteCache.primeClean(FILE_PATH, "local", "hash-local", { localCreated: true })
		mockReadFileSnapshot.mockResolvedValue({
			content: "remote",
			hash: "hash-remote",
			metadata: { createdAt: 1, modifiedAt: 4 },
		})

		await noteCache.handleExternalChange(FILE_PATH, "hash-remote")

		expect(noteCache.getEntry(FILE_PATH)?.localCreatedAt).toBeUndefined()
	})
})

describe("forget()", () => {
	it("removes a cached file entry", async () => {
		await seedEntry()

		noteCache.forget(FILE_PATH)

		expect(noteCache.getEntry(FILE_PATH)).toBeUndefined()
	})

	it("removes cached descendants for deleted folders", async () => {
		await seedEntry("root", "hash-root")
		mockSnapshot("/vault/folder/nested.md", "nested")
		await noteCache.read("/vault/folder/nested.md")

		noteCache.forget("/vault/folder", { descendants: true })

		expect(noteCache.getEntry("/vault/folder/nested.md")).toBeUndefined()
		expect(noteCache.getEntry(FILE_PATH)).toBeDefined()
	})

	it("does not publish a pending descendant preload after forgetting a folder", async () => {
		const nestedPath = "/vault/folder/nested.md"
		let releaseSnapshot: ((content: string) => void) | undefined
		const pendingSnapshot = new Promise<{
			content: string
			hash: string
			metadata: { createdAt: number; modifiedAt: number }
		}>((resolve) => {
			releaseSnapshot = (content) =>
				resolve({
					content,
					hash: "hash-nested",
					metadata: { createdAt: 1, modifiedAt: 2 },
				})
		})
		mockReadFileSnapshot.mockReturnValue(pendingSnapshot)

		noteCache.openTab(nestedPath)
		noteCache.forget("/vault/folder", { descendants: true })
		releaseSnapshot?.("nested")
		await pendingSnapshot
		await Promise.resolve()

		expect(noteCache.getEntry(nestedPath)).toBeUndefined()
	})
})

describe("onContentChange()", () => {
	it("calls listener when writeExternal updates content", async () => {
		await seedEntry()
		const listener = vi.fn()
		noteCache.onContentChange(FILE_PATH, listener)
		noteCache.writeExternal(FILE_PATH, "new content")
		expect(listener).toHaveBeenCalledTimes(1)
		expect(listener).toHaveBeenCalledWith(FILE_PATH, "new content")
	})

	it("unsubscribe stops listener from being called", async () => {
		await seedEntry()
		const listener = vi.fn()
		const unsubscribe = noteCache.onContentChange(FILE_PATH, listener)
		unsubscribe()
		noteCache.writeExternal(FILE_PATH, "new content")
		expect(listener).not.toHaveBeenCalled()
	})

	it("supports multiple listeners for same file", async () => {
		await seedEntry()
		const listenerA = vi.fn()
		const listenerB = vi.fn()
		noteCache.onContentChange(FILE_PATH, listenerA)
		noteCache.onContentChange(FILE_PATH, listenerB)
		noteCache.writeExternal(FILE_PATH, "updated")
		expect(listenerA).toHaveBeenCalled()
		expect(listenerB).toHaveBeenCalled()
	})
})

describe("isDirty() / getEntry() / getSnapshots()", () => {
	it("isDirty returns false for clean entry", async () => {
		await seedEntry()
		expect(noteCache.isDirty(FILE_PATH)).toBe(false)
	})

	it("isDirty returns false for nonexistent entry", () => {
		expect(noteCache.isDirty("/nonexistent.md")).toBe(false)
	})

	it("getEntry returns undefined for nonexistent path", () => {
		expect(noteCache.getEntry("/nonexistent.md")).toBeUndefined()
	})

	it("getSnapshots returns empty array for nonexistent path", () => {
		expect(noteCache.getSnapshots("/nonexistent.md")).toEqual([])
	})
})
