import { getPlatform } from "@cortex/platform"
import { resetPropertiesRuntime } from "@cortex/properties"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { noteCache } from "../../noteCache"
import { createBookmarkedPaths, useBookmarksStore } from "../bookmarksStore"
import { useVaultStore } from "../vaultStore"

function mockFilePlatform(files = new Map<string, string>()) {
	const readFile = vi.fn(async (path: string) => {
		const content = files.get(path)
		if (content === undefined) throw new Error(`Missing ${path}`)
		return content
	})
	const readFileSnapshot = vi.fn(async (path: string) => {
		const content = files.get(path)
		if (content === undefined) throw new Error(`Missing ${path}`)
		return {
			content,
			hash: `hash:${path}`,
			metadata: { createdAt: 1, modifiedAt: 2 },
		}
	})
	const writeFile = vi.fn(async (path: string, content: string) => {
		files.set(path, content)
	})
	const deleteFile = vi.fn(async (path: string) => {
		for (const filePath of Array.from(files.keys())) {
			if (filePath === path || filePath.startsWith(`${path}/`)) files.delete(filePath)
		}
	})
	const renameFile = vi.fn(async (oldPath: string, newPath: string) => {
		if (files.has(newPath)) throw new Error("Destination already exists")
		const updates = Array.from(files.entries()).flatMap(([filePath, content]) => {
			if (filePath === oldPath) return [[newPath, content] as const]
			if (filePath.startsWith(`${oldPath}/`)) {
				return [[`${newPath}${filePath.slice(oldPath.length)}`, content] as const]
			}
			return []
		})
		if (updates.length === 0) throw new Error(`Missing ${oldPath}`)
		for (const filePath of Array.from(files.keys())) {
			if (filePath === oldPath || filePath.startsWith(`${oldPath}/`)) files.delete(filePath)
		}
		for (const [filePath, content] of updates) files.set(filePath, content)
	})
	const hashFile = vi.fn(async (path: string) => `hash:${path}`)
	const getFileMetadata = vi.fn(async () => ({ createdAt: 1, modifiedAt: 2 }))
	const scanVault = vi.fn(async () =>
		Array.from(files.keys()).map((path) => ({
			path,
			name: path.split("/").pop() ?? path,
			isDir: false,
		})),
	)
	vi.mocked(getPlatform).mockReturnValue({
		fs: {
			readFile,
			readFileSnapshot,
			writeFile,
			deleteFile,
			renameFile,
			hashFile,
			getFileMetadata,
			createDir: vi.fn().mockResolvedValue(undefined),
		},
		vault: { scanVault },
	} as never)
	return {
		files,
		readFile,
		readFileSnapshot,
		writeFile,
		deleteFile,
		renameFile,
		hashFile,
		getFileMetadata,
		scanVault,
	}
}

beforeEach(() => {
	noteCache.clear()
	resetPropertiesRuntime()
	useBookmarksStore.getState().reset()
	useVaultStore.setState({
		vault: {
			uuid: "vault-id",
			path: "/vault",
			name: "Vault",
			fileCount: 1,
		},
		files: [],
		error: null,
	})
	vi.clearAllMocks()
})

describe("vaultStore file creation and cache ownership", () => {
	it("creates a unique note path instead of overwriting an existing note", async () => {
		const platform = mockFilePlatform(new Map([["/vault/Untitled.md", "existing"]]))

		const filePath = await useVaultStore.getState().createFile("/vault", "Untitled")

		expect(filePath).toBe("/vault/Untitled 2.md")
		expect(platform.files.get("/vault/Untitled.md")).toBe("existing")
		expect(platform.files.get(filePath)).toBeDefined()
		expect(noteCache.getEntry(filePath)).toMatchObject({
			content: platform.files.get(filePath),
			dirty: false,
			hash: `hash:${filePath}`,
		})
	})

	it("does not reuse stale cached frontmatter after deleting and recreating the same name", async () => {
		const staleContent = "---\nproject: Old\n---\nBody"
		const platform = mockFilePlatform(new Map([["/vault/Untitled.md", staleContent]]))
		await noteCache.read("/vault/Untitled.md")

		await useVaultStore.getState().deleteFile("/vault/Untitled.md")
		expect(noteCache.getEntry("/vault/Untitled.md")).toBeUndefined()

		const filePath = await useVaultStore.getState().createFile("/vault", "Untitled")

		expect(filePath).toBe("/vault/Untitled.md")
		expect(noteCache.getEntry(filePath)?.content).toBe(platform.files.get(filePath))
		expect(noteCache.getEntry(filePath)?.content).not.toContain("project: Old")
	})

	it("removes bookmarks for deleted notes", async () => {
		mockFilePlatform(new Map([["/vault/Untitled.md", "content"]]))
		useVaultStore.setState({
			files: [{ path: "/vault/Untitled.md", name: "Untitled.md", isDir: false }],
		})
		useBookmarksStore.setState({
			bookmarks: [{ path: "Untitled.md", addedAt: 1 }],
			bookmarkedPaths: createBookmarkedPaths([{ path: "Untitled.md", addedAt: 1 }]),
			error: null,
		})

		await useVaultStore.getState().deleteFile("/vault/Untitled.md")

		expect(useBookmarksStore.getState().bookmarks).toEqual([])
	})

	it("moves a note without overwriting an existing destination", async () => {
		const platform = mockFilePlatform(
			new Map([
				["/vault/Note.md", "content"],
				["/vault/Folder/.keep", ""],
			]),
		)
		useVaultStore.setState({
			files: [
				{ path: "/vault/Note.md", name: "Note.md", isDir: false },
				{ path: "/vault/Folder", name: "Folder", isDir: true },
			],
		})

		const newPath = await useVaultStore.getState().moveFile("/vault/Note.md", "/vault/Folder")

		expect(newPath).toBe("/vault/Folder/Note.md")
		expect(platform.renameFile).toHaveBeenCalledWith("/vault/Note.md", "/vault/Folder/Note.md")
		expect(platform.files.get("/vault/Folder/Note.md")).toBe("content")
	})

	it("rejects move destinations that already exist", async () => {
		mockFilePlatform(
			new Map([
				["/vault/Note.md", "content"],
				["/vault/Folder/Note.md", "existing"],
			]),
		)
		useVaultStore.setState({
			files: [
				{ path: "/vault/Note.md", name: "Note.md", isDir: false },
				{ path: "/vault/Folder", name: "Folder", isDir: true },
				{ path: "/vault/Folder/Note.md", name: "Note.md", isDir: false },
			],
		})

		await expect(
			useVaultStore.getState().moveFile("/vault/Note.md", "/vault/Folder"),
		).rejects.toThrow("Destination already exists")
	})
})
