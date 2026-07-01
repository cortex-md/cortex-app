import { getPlatform } from "@cortex/platform"
import { onVaultSchemaChange } from "@cortex/properties"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	createDefaultSyncPreferences,
	shouldIgnoreSyncPath,
	useSyncStore,
} from "../../stores/syncStore"
import { useVaultStore } from "../../stores/vaultStore"

function mockPlatform({
	readFile = vi.fn().mockResolvedValue(""),
	writeFile = vi.fn().mockResolvedValue(undefined),
	updateSyncPreferences = vi.fn().mockResolvedValue(undefined),
} = {}) {
	vi.mocked(getPlatform).mockReturnValue({
		fs: {
			readFile,
			writeFile,
		},
		sync: {
			updateSyncPreferences,
		},
	} as never)

	return { readFile, writeFile, updateSyncPreferences }
}

beforeEach(() => {
	useSyncStore.setState({
		syncPreferences: createDefaultSyncPreferences(),
		noteMetadataRevisions: {},
		error: null,
	})
	useVaultStore.setState({
		vault: null,
		files: [],
	})
	vi.clearAllMocks()
})

describe("syncStore preferences", () => {
	it("loads older sync preferences with ignoreImages defaulting to false", async () => {
		const { updateSyncPreferences } = mockPlatform({
			readFile: vi.fn().mockResolvedValue(
				JSON.stringify({
					syncSettings: true,
					excludedPaths: ["private/"],
				}),
			),
		})

		await useSyncStore.getState().loadSyncPreferences("/vault")

		expect(useSyncStore.getState().syncPreferences).toEqual({
			...createDefaultSyncPreferences(),
			syncSettings: true,
			ignoreImages: false,
			syncBookmarks: false,
			excludedPaths: ["private/"],
		})
		expect(updateSyncPreferences).toHaveBeenCalledWith(
			expect.objectContaining({
				syncSettings: true,
				ignoreImages: false,
				syncBookmarks: false,
				excludedPaths: ["private/"],
			}),
		)
	})

	it("persists ignoreImages updates and sends them to the sync engine", async () => {
		const { writeFile, updateSyncPreferences } = mockPlatform()
		useVaultStore.setState({
			vault: {
				uuid: "vault-id",
				path: "/vault",
				name: "Vault",
				fileCount: 0,
			},
		})

		await useSyncStore.getState().updateSyncPreference("ignoreImages", true)

		expect(writeFile).toHaveBeenCalledWith(
			"/vault/.cortex/sync-preferences.json",
			expect.any(String),
		)
		expect(JSON.parse(writeFile.mock.calls[0][1])).toEqual(
			expect.objectContaining({ ignoreImages: true }),
		)
		expect(updateSyncPreferences).toHaveBeenCalledWith(
			expect.objectContaining({ ignoreImages: true }),
		)
	})

	it("recognizes image paths when ignoreImages is enabled", () => {
		const preferences = {
			...createDefaultSyncPreferences(),
			ignoreImages: true,
		}

		expect(shouldIgnoreSyncPath("attachments/photo.WEBP", preferences)).toBe(true)
		expect(shouldIgnoreSyncPath("attachments/photo.md", preferences)).toBe(false)
	})

	it("syncs shared schemas while keeping derived state local", () => {
		const preferences = createDefaultSyncPreferences()
		expect(shouldIgnoreSyncPath(".cortex/schema/properties.json", preferences)).toBe(false)
		expect(shouldIgnoreSyncPath(".cortex/schema/databases.json", preferences)).toBe(false)
		expect(shouldIgnoreSyncPath(".cortex/database-index.json", preferences)).toBe(true)
		expect(shouldIgnoreSyncPath(".cortex/ui-state.json", preferences)).toBe(true)
	})

	it("keeps bookmarks local unless bookmark sync is enabled", () => {
		const preferences = createDefaultSyncPreferences()

		expect(preferences.syncBookmarks).toBe(false)
		expect(shouldIgnoreSyncPath(".cortex/bookmarks.json", preferences)).toBe(true)
		expect(
			shouldIgnoreSyncPath(".cortex/bookmarks.json", {
				...preferences,
				syncBookmarks: true,
			}),
		).toBe(false)
	})

	it("persists bookmark sync updates and sends them to the sync engine", async () => {
		const { writeFile, updateSyncPreferences } = mockPlatform()
		useVaultStore.setState({
			vault: {
				uuid: "vault-id",
				path: "/vault",
				name: "Vault",
				fileCount: 0,
			},
		})

		await useSyncStore.getState().updateSyncPreference("syncBookmarks", true)

		expect(JSON.parse(writeFile.mock.calls[0][1])).toEqual(
			expect.objectContaining({ syncBookmarks: true }),
		)
		expect(updateSyncPreferences).toHaveBeenCalledWith(
			expect.objectContaining({ syncBookmarks: true }),
		)
	})

	it("matches gitignore-style excluded path patterns", () => {
		const preferences = {
			...createDefaultSyncPreferences(),
			excludedPaths: ["node_modules/", "*.log", "docs/**/*.tmp", "dist/", "!dist/keep.md"],
		}

		expect(shouldIgnoreSyncPath("node_modules/package.json", preferences)).toBe(true)
		expect(shouldIgnoreSyncPath("packages/app/node_modules/cache.bin", preferences)).toBe(true)
		expect(shouldIgnoreSyncPath("logs/debug.log", preferences)).toBe(true)
		expect(shouldIgnoreSyncPath("docs/drafts/one.tmp", preferences)).toBe(true)
		expect(shouldIgnoreSyncPath("dist/app.js", preferences)).toBe(true)
		expect(shouldIgnoreSyncPath("dist/keep.md", preferences)).toBe(false)
		expect(shouldIgnoreSyncPath("src/node_modules.md", preferences)).toBe(false)
	})

	it("uses sync file events for state without re-reading note contents", async () => {
		const hashFile = vi.fn()
		let fileListener: ((event: { path: string; status: string }) => void) | undefined
		const listen = (callback?: (event: never) => void) => {
			if (callback) return Promise.resolve(vi.fn())
			return Promise.resolve(vi.fn())
		}
		vi.mocked(getPlatform).mockReturnValue({
			fs: { hashFile },
			sync: {
				onStateChanged: listen,
				onFileEvent: vi.fn().mockImplementation(async (callback) => {
					fileListener = callback
					return vi.fn()
				}),
				onInitialSyncProgress: listen,
				onConflict: listen,
				onInitialSyncComplete: listen,
				onVekRequired: listen,
				onSyncLog: listen,
				onVaultAccessDenied: listen,
			},
		} as never)
		useVaultStore.setState({
			vault: {
				uuid: "vault-id",
				path: "/vault",
				name: "Vault",
				fileCount: 1,
			},
		})
		const schemaListener = vi.fn()
		const unsubscribeSchema = onVaultSchemaChange("/vault", schemaListener)

		await useSyncStore.getState().subscribeEvents()
		fileListener?.({ path: "note.md", status: "synced" })
		fileListener?.({ path: "note.md", status: "merged" })
		fileListener?.({ path: "note.md", status: "deleted" })
		fileListener?.({ path: ".cortex/schema/properties.json", status: "synced" })

		expect(hashFile).not.toHaveBeenCalled()
		expect(useSyncStore.getState().noteMetadataRevisions).toEqual({
			"note.md": 2,
			".cortex/schema/properties.json": 1,
		})
		await vi.waitFor(() => expect(schemaListener).toHaveBeenCalledTimes(1))
		unsubscribeSchema()
		useSyncStore.getState().unsubscribeEvents()
	})
})
