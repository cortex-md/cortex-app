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
	const writeFileSnapshot = vi.fn(async (path: string, content: string) => {
		files.set(path, content)
		return {
			content,
			hash: `hash:${path}`,
			metadata: { createdAt: 1, modifiedAt: 2 },
		}
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
	const directories = new Set<string>()
	const getFileMetadata = vi.fn(async (path: string) => {
		if (!files.has(path) && !directories.has(path)) throw new Error(`Missing ${path}`)
		return { createdAt: 1, modifiedAt: 2 }
	})
	const createDir = vi.fn(async (path: string) => {
		directories.add(path)
	})
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
			writeFileSnapshot,
			writeFile,
			deleteFile,
			renameFile,
			hashFile,
			getFileMetadata,
			createDir,
		},
		vault: { scanVault },
	} as never)
	return {
		files,
		directories,
		readFile,
		readFileSnapshot,
		writeFileSnapshot,
		writeFile,
		deleteFile,
		renameFile,
		hashFile,
		getFileMetadata,
		createDir,
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
		expect(platform.writeFileSnapshot).toHaveBeenCalledWith(filePath, platform.files.get(filePath))
		expect(platform.writeFile).not.toHaveBeenCalled()
		expect(platform.hashFile).not.toHaveBeenCalled()
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

	it("keeps a created note when post-write fingerprint reads fail", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
		try {
			const platform = mockFilePlatform()
			platform.writeFileSnapshot.mockRejectedValue(new Error("snapshot write unavailable"))
			platform.hashFile.mockRejectedValue(new Error("file is temporarily locked"))

			const filePath = await useVaultStore.getState().createFile("/vault", "Untitled")

			expect(filePath).toBe("/vault/Untitled.md")
			expect(platform.files.get(filePath)).toBeDefined()
			expect(noteCache.getEntry(filePath)).toMatchObject({
				content: platform.files.get(filePath),
				dirty: false,
				localCreatedAt: expect.any(Number),
			})
			expect(noteCache.getEntry(filePath)?.hash).toContain("local-created:")
		} finally {
			consoleError.mockRestore()
		}
	})

	it("validates folder names before creating them", async () => {
		const platform = mockFilePlatform()

		await expect(useVaultStore.getState().createFolder("/vault", "bad/name")).rejects.toThrow(
			"File name contains characters that are not supported on every platform",
		)

		expect(platform.createDir).not.toHaveBeenCalled()
	})

	it("creates a unique folder path instead of reusing an existing folder", async () => {
		const platform = mockFilePlatform()
		platform.directories.add("/vault/New Folder")

		await expect(useVaultStore.getState().createFolder("/vault", "New Folder")).resolves.toBe(
			"/vault/New Folder 2",
		)

		expect(platform.createDir).toHaveBeenCalledWith("/vault/New Folder 2")
	})

	it("keeps a created folder when the post-create refresh fails", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
		try {
			const platform = mockFilePlatform()
			platform.scanVault.mockRejectedValueOnce(new Error("scan is temporarily unavailable"))

			await expect(useVaultStore.getState().createFolder("/vault", "New Folder")).resolves.toBe(
				"/vault/New Folder",
			)

			expect(platform.createDir).toHaveBeenCalledWith("/vault/New Folder")
			expect(useVaultStore.getState().error).toBe("Error: scan is temporarily unavailable")
		} finally {
			consoleError.mockRestore()
		}
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
