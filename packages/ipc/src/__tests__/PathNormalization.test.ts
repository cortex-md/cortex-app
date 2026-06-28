import { beforeEach, describe, expect, it, vi } from "vitest"
import { Dialog } from "../Dialog"
import { FileSystem } from "../FileSystem"
import { Sync } from "../Sync"
import { Vault } from "../Vault"

const coreMock = vi.hoisted(() => ({
	invoke: vi.fn(),
}))

const eventMock = vi.hoisted(() => ({
	listen: vi.fn(),
}))

const dialogMock = vi.hoisted(() => ({
	open: vi.fn(),
	save: vi.fn(),
	confirm: vi.fn(),
	message: vi.fn(),
}))

const openerMock = vi.hoisted(() => ({
	revealItemInDir: vi.fn(),
}))

vi.mock("@tauri-apps/api/core", () => ({
	invoke: coreMock.invoke,
}))

vi.mock("@tauri-apps/api/event", () => ({
	listen: eventMock.listen,
}))

vi.mock("@tauri-apps/plugin-dialog", () => ({
	open: dialogMock.open,
	save: dialogMock.save,
	confirm: dialogMock.confirm,
	message: dialogMock.message,
}))

vi.mock("@tauri-apps/plugin-opener", () => ({
	revealItemInDir: openerMock.revealItemInDir,
}))

describe("IPC path normalization", () => {
	beforeEach(() => {
		coreMock.invoke.mockReset()
		eventMock.listen.mockReset()
		dialogMock.open.mockReset()
		dialogMock.save.mockReset()
		dialogMock.confirm.mockReset()
		dialogMock.message.mockReset()
		openerMock.revealItemInDir.mockReset()
	})

	it("normalizes vault metadata, registry entries, and file entries from Rust commands", async () => {
		coreMock.invoke.mockImplementation(async (command: string) => {
			if (command === "open_vault") {
				return {
					uuid: "vault-id",
					path: "C:\\Users\\Luiza\\Vault",
					name: "Vault",
					fileCount: 1,
				}
			}
			if (command === "scan_vault") {
				return [
					{
						path: "C:\\Users\\Luiza\\Vault\\Note.md",
						name: "Note.md",
						isDir: false,
					},
				]
			}
			if (command === "read_vault_registry") {
				return [
					{
						uuid: "vault-id",
						path: "C:\\Users\\Luiza\\Vault",
						name: "Vault",
						lastOpened: 1,
						icon: null,
						color: null,
					},
				]
			}
			return null
		})
		const vault = new Vault()

		await expect(vault.openVault("C:/Users/Luiza/Vault")).resolves.toMatchObject({
			path: "C:/Users/Luiza/Vault",
			displayPath: "C:\\Users\\Luiza\\Vault",
		})
		await expect(vault.scanVault("C:/Users/Luiza/Vault")).resolves.toMatchObject([
			{ path: "C:/Users/Luiza/Vault/Note.md" },
		])
		await expect(vault.readVaultRegistry()).resolves.toMatchObject([
			{
				path: "C:/Users/Luiza/Vault",
				displayPath: "C:\\Users\\Luiza\\Vault",
			},
		])
	})

	it("normalizes filesystem list entries and watcher events", async () => {
		const unlisten = vi.fn()
		const watcherCallbacks: Array<(event: { payload: unknown }) => void> = []
		coreMock.invoke.mockResolvedValueOnce([
			{ path: "C:\\Vault\\Folder", name: "Folder", isDir: true },
		])
		coreMock.invoke.mockResolvedValueOnce("watcher-1")
		eventMock.listen.mockImplementation(async (_eventName: string, callback) => {
			watcherCallbacks[0] = callback
			return unlisten
		})
		const fs = new FileSystem()
		const listener = vi.fn()

		await expect(fs.listDir("C:/Vault")).resolves.toMatchObject([{ path: "C:/Vault/Folder" }])
		await fs.startWatching("C:/Vault", listener)
		expect(watcherCallbacks[0]).toBeDefined()
		watcherCallbacks[0]?.({
			payload: {
				path: "C:\\Vault\\Note.md",
				kind: "created",
				watcherId: "watcher-1",
			},
		})

		expect(listener).toHaveBeenCalledWith({
			path: "C:/Vault/Note.md",
			kind: "created",
			watcherId: "watcher-1",
		})
	})

	it("writes a file snapshot through one native filesystem command", async () => {
		coreMock.invoke.mockResolvedValueOnce({
			content: "Body",
			hash: "hash",
			metadata: { createdAt: 1, modifiedAt: 2 },
		})
		const fs = new FileSystem()

		await expect(fs.writeFileSnapshot("C:/Vault/Note.md", "Body")).resolves.toMatchObject({
			content: "Body",
			hash: "hash",
			metadata: { createdAt: 1, modifiedAt: 2 },
		})

		expect(coreMock.invoke).toHaveBeenCalledWith("write_file_snapshot", {
			path: "C:/Vault/Note.md",
			content: "Body",
		})
	})

	it("normalizes paths returned by native dialogs", async () => {
		dialogMock.open.mockResolvedValueOnce("C:\\Vault")
		dialogMock.open.mockResolvedValueOnce(["C:\\Vault\\Note.md"])
		dialogMock.save.mockResolvedValueOnce("C:\\Vault\\Export.md")
		const dialog = new Dialog()

		await expect(dialog.pickFolder()).resolves.toBe("C:/Vault")
		await expect(dialog.pickFile()).resolves.toBe("C:/Vault/Note.md")
		await expect(dialog.saveFile()).resolves.toBe("C:/Vault/Export.md")
	})

	it("normalizes sync paths from command results and events", async () => {
		const unlistenFile = vi.fn()
		const unlistenConflict = vi.fn()
		const callbacks: Array<(event: { payload: unknown }) => void> = []
		coreMock.invoke.mockImplementation(async (command: string) => {
			if (command === "sync_get_conflicts") {
				return [
					{
						filePath: "Notes\\Conflict.md",
						localHash: "local",
						remoteHash: "remote",
						ancestorHash: null,
						localContent: null,
						remoteContent: null,
					},
				]
			}
			if (command === "sync_list_deleted_files") {
				return [
					{
						filePath: "Archive\\Deleted.md",
						version: 1,
						sizeBytes: null,
						checksum: null,
						contentType: null,
						deletedAt: null,
						lastModifiedBy: null,
						lastDeviceId: null,
					},
				]
			}
			return null
		})
		eventMock.listen.mockImplementation(async (_eventName: string, callback) => {
			callbacks.push(callback)
			return callbacks.length === 1 ? unlistenFile : unlistenConflict
		})
		const sync = new Sync()
		const fileListener = vi.fn()
		const conflictListener = vi.fn()

		await expect(sync.getConflicts("vault-id", "C:/Vault")).resolves.toMatchObject([
			{ filePath: "Notes/Conflict.md" },
		])
		await expect(sync.listDeletedFiles("vault-id", "C:/Vault")).resolves.toMatchObject([
			{ filePath: "Archive/Deleted.md" },
		])
		await sync.onFileEvent(fileListener)
		await sync.onConflict(conflictListener)
		callbacks[0]?.({ payload: { path: "Notes\\Plan.md", status: "synced" } })
		callbacks[1]?.({ payload: { path: "Notes\\Conflict.md" } })

		expect(fileListener).toHaveBeenCalledWith({ path: "Notes/Plan.md", status: "synced" })
		expect(conflictListener).toHaveBeenCalledWith({ path: "Notes/Conflict.md" })
	})
})
