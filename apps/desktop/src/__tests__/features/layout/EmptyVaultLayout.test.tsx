import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

let firstRunOnboardingSeen: boolean | null = false
let recentVaults: Array<{
	path: string
	name: string
	uuid: string
	lastOpened: number
	icon: string | null
	color: string | null
}> = []

const openAuth = vi.fn()
const openSettings = vi.fn()
const openVault = vi.fn()

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
	useAppStore: vi.fn((selector?: (state: unknown) => unknown) => {
		const state = {
			firstRunOnboardingSeen,
			version: "0.1.0",
		}
		return selector ? selector(state) : state
	}),
	useAuthStore: vi.fn((selector?: (state: unknown) => unknown) => {
		const state = { authenticated: false, user: null }
		return selector ? selector(state) : state
	}),
	useSyncStore: vi.fn((selector) => selector({ saveSyncPreferences: vi.fn() })),
	useUIStore: vi.fn((selector) => selector({ openAuth, openSettings })),
	useVaultStore: vi.fn((selector?: (state: unknown) => unknown) => {
		const state = { recentVaults, openVault }
		return selector ? selector(state) : state
	}),
}))

vi.mock("@cortex/platform", () => ({
	getPlatform: vi.fn(() => ({
		dialog: {
			pickFolder: vi.fn(),
		},
		vault: {
			scanVault: vi.fn().mockResolvedValue([]),
		},
	})),
}))

import { EmptyVaultLayout } from "../../../features/layout/empty-vault-layout"

afterEach(() => {
	cleanup()
	recentVaults = []
	firstRunOnboardingSeen = false
	vi.clearAllMocks()
})

describe("EmptyVaultLayout", () => {
	it("shows guided first-run copy when no vault has been opened", () => {
		render(<EmptyVaultLayout />)

		expect(screen.getByText(/Start with a folder/)).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /Create new vault/i })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /Open folder/i })).toBeInTheDocument()
	})

	it("shows recent vaults instead of first-run guidance for returning users", () => {
		firstRunOnboardingSeen = true
		recentVaults = [
			{
				uuid: "vault-id",
				path: "/vault",
				name: "Writing",
				lastOpened: 1,
				icon: null,
				color: null,
			},
		]

		render(<EmptyVaultLayout />)

		expect(screen.queryByText(/Start with a folder/)).not.toBeInTheDocument()
		expect(screen.getByText("Recent vaults")).toBeInTheDocument()
		expect(screen.getByText("Writing")).toBeInTheDocument()
	})
})
