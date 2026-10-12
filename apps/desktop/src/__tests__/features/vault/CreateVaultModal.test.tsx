import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const createVaultFromFolder = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const scanVault = vi.fn().mockResolvedValue([
	{ path: "/vault/notes", name: "notes", isDir: true, size: 0, mtime: 1 },
	{ path: "/vault/attachments/photo.png", name: "photo.png", isDir: false, size: 10, mtime: 1 },
])

vi.mock("@cortex/core", async (importOriginal) => ({
	...(await importOriginal<typeof import("@cortex/core")>()),
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
	createVaultFromFolder,
}))

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(() => ({
		vault: {
			scanVault,
		},
	})),
}))

import { CreateVaultModalHost } from "../../../features/vault/CreateVaultModal"
import { createVaultModal } from "../../../features/vault/createVaultModalStore"

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("CreateVaultModal", () => {
	it("requires sync preferences before closing a new vault", async () => {
		createVaultModal.open({ folderPath: "/vault", defaultName: "vault" })
		render(<CreateVaultModalHost />)

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
			expect(createVaultFromFolder).toHaveBeenCalledWith("/vault", {
				icon: undefined,
				name: "vault",
				syncPreferences: expect.objectContaining({
					ignoreImages: true,
					syncBookmarks: true,
					excludedPaths: ["node_modules/"],
				}),
			})
		})
		expect(createVaultModal.getTarget()).toBeNull()
	})
})
