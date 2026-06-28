import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const openVault = vi.fn().mockResolvedValue(undefined)
const saveSyncPreferences = vi.fn().mockResolvedValue(undefined)
const scanVault = vi.fn().mockResolvedValue([
	{ path: "/vault/notes", name: "notes", isDir: true, size: 0, mtime: 1 },
	{ path: "/vault/attachments/photo.png", name: "photo.png", isDir: false, size: 10, mtime: 1 },
])

vi.mock("@cortex/core", () => ({
	createDefaultSyncPreferences: () => ({
		syncSettings: false,
		syncHotkeys: false,
		syncWorkspace: false,
		syncPluginMetadata: false,
		syncThemeMetadata: false,
		syncBookmarks: false,
		ignoreImages: false,
		excludedPaths: [],
	}),
	isSyncImagePath: (path: string) => path.endsWith(".png"),
	normalizeSyncPathPattern: (pattern: string) => pattern.replaceAll("\\", "/").trim(),
	shouldIgnoreSyncPath: (path: string, preferences: { excludedPaths: string[] }) =>
		preferences.excludedPaths.includes(path),
	useSyncStore: vi.fn((selector) => selector({ saveSyncPreferences })),
	useVaultStore: vi.fn((selector?: (state: unknown) => unknown) => {
		const state = { openVault }
		return selector ? selector(state) : state
	}),
}))

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(() => ({
		vault: {
			scanVault,
		},
	})),
}))

import { CreateVaultModal } from "../../../features/vault/CreateVaultModal"

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("CreateVaultModal", () => {
	it("requires sync preferences before closing a new vault", async () => {
		const onOpenChange = vi.fn()
		render(<CreateVaultModal open folderPath="/vault" onOpenChange={onOpenChange} />)

		await userEvent.click(screen.getByRole("button", { name: "Continue" }))
		await userEvent.click(screen.getByRole("switch", { name: "Ignore images" }))
		await userEvent.click(screen.getByRole("switch", { name: "Sync bookmarks" }))
		await userEvent.type(
			screen.getByPlaceholderText("Search files, folders, or add a pattern..."),
			"node_modules/",
		)
		await userEvent.click(screen.getByRole("button", { name: 'Add pattern "node_modules/"' }))
		await userEvent.click(screen.getByRole("button", { name: "Create vault" }))

		await waitFor(() => {
			expect(openVault).toHaveBeenCalledWith("/vault", {
				icon: undefined,
				color: "#fb7185",
				name: "vault",
				createOnboardingNote: true,
			})
		})
		expect(saveSyncPreferences).toHaveBeenCalledWith(
			"/vault",
			expect.objectContaining({
				ignoreImages: true,
				syncBookmarks: true,
				excludedPaths: ["node_modules/"],
			}),
		)
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})
})
