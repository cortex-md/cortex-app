import { getPlatform } from "@cortex/platform"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { noteCache } from "../../noteCache"
import { createBookmarkedPaths, useBookmarksStore } from "../../stores/bookmarksStore"
import { useVaultStore } from "../../stores/vaultStore"
import { useWorkspaceStore } from "../../stores/workspaceStore"

const oldPath = "/vault/Current.md"
const newPath = "/vault/Renamed.md"

beforeEach(() => {
	noteCache.clear()
	useBookmarksStore.getState().reset()
	useWorkspaceStore.getState().reset()
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

describe("vaultStore renameFile", () => {
	it("flushes and migrates cache, tabs, and bookmarks after the platform rename", async () => {
		const readFile = vi.fn().mockResolvedValue("initial")
		const readFileSnapshot = vi.fn().mockResolvedValue({
			content: "initial",
			hash: "hash",
			metadata: { createdAt: 1, modifiedAt: 2 },
		})
		const writeFile = vi.fn().mockResolvedValue(undefined)
		const hashFile = vi.fn().mockResolvedValue("hash")
		const getFileMetadata = vi.fn().mockResolvedValue({ createdAt: 1, modifiedAt: 3 })
		const renameFile = vi.fn().mockResolvedValue(undefined)
		const scanVault = vi.fn().mockResolvedValue([])
		vi.mocked(getPlatform).mockReturnValue({
			fs: { readFile, readFileSnapshot, writeFile, hashFile, getFileMetadata, renameFile },
			vault: { scanVault },
		} as never)

		await noteCache.read(oldPath)
		noteCache.write(oldPath, "changed")
		useWorkspaceStore.getState().openTab(oldPath)
		useBookmarksStore.setState({
			bookmarks: [{ path: "Current.md", addedAt: 1 }],
			bookmarkedPaths: createBookmarkedPaths([{ path: "Current.md", addedAt: 1 }]),
			error: null,
		})

		const result = await useVaultStore.getState().renameFile(oldPath, "Renamed.md")

		expect(result).toBe(newPath)
		expect(writeFile).toHaveBeenCalledWith(oldPath, "changed")
		expect(renameFile).toHaveBeenCalledWith(oldPath, newPath)
		expect(writeFile.mock.invocationCallOrder[0]).toBeLessThan(
			renameFile.mock.invocationCallOrder[0],
		)
		expect(noteCache.getEntry(oldPath)).toBeUndefined()
		expect(noteCache.getEntry(newPath)?.openTabCount).toBe(1)
		expect(
			Object.values(useWorkspaceStore.getState().panes).flatMap((pane) =>
				pane.tabs.map((tab) => tab.filePath),
			),
		).toContain(newPath)
		expect(useBookmarksStore.getState().bookmarks).toEqual([{ path: "Renamed.md", addedAt: 1 }])
	})

	it("moves folder descendants through cache, tabs, and bookmarks", async () => {
		const readFile = vi.fn().mockResolvedValue("initial")
		const readFileSnapshot = vi.fn().mockResolvedValue({
			content: "initial",
			hash: "hash",
			metadata: { createdAt: 1, modifiedAt: 2 },
		})
		const writeFile = vi.fn().mockResolvedValue(undefined)
		const hashFile = vi.fn().mockResolvedValue("hash")
		const getFileMetadata = vi.fn().mockResolvedValue({ createdAt: 1, modifiedAt: 3 })
		const renameFile = vi.fn().mockResolvedValue(undefined)
		const scanVault = vi.fn().mockResolvedValue([])
		vi.mocked(getPlatform).mockReturnValue({
			fs: { readFile, readFileSnapshot, writeFile, hashFile, getFileMetadata, renameFile },
			vault: { scanVault },
		} as never)
		useVaultStore.setState({
			files: [
				{ path: "/vault/Folder", name: "Folder", isDir: true },
				{ path: "/vault/Folder/Current.md", name: "Current.md", isDir: false },
				{ path: "/vault/Archive", name: "Archive", isDir: true },
			],
		})
		await noteCache.read("/vault/Folder/Current.md")
		noteCache.write("/vault/Folder/Current.md", "changed")
		useWorkspaceStore.getState().openTab("/vault/Folder/Current.md")
		useBookmarksStore.setState({
			bookmarks: [{ path: "Folder/Current.md", addedAt: 1 }],
			bookmarkedPaths: createBookmarkedPaths([{ path: "Folder/Current.md", addedAt: 1 }]),
			error: null,
		})

		const result = await useVaultStore.getState().moveFile("/vault/Folder", "/vault/Archive")

		expect(result).toBe("/vault/Archive/Folder")
		expect(writeFile).toHaveBeenCalledWith("/vault/Folder/Current.md", "changed")
		expect(renameFile).toHaveBeenCalledWith("/vault/Folder", "/vault/Archive/Folder")
		expect(noteCache.getEntry("/vault/Archive/Folder/Current.md")).toBeDefined()
		expect(
			Object.values(useWorkspaceStore.getState().panes).flatMap((pane) =>
				pane.tabs.map((tab) => tab.filePath),
			),
		).toContain("/vault/Archive/Folder/Current.md")
		expect(useBookmarksStore.getState().bookmarks).toEqual([
			{ path: "Archive/Folder/Current.md", addedAt: 1 },
		])
	})
})
