import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock all @cortex/core stores
vi.mock("@cortex/core", () => ({
	useSyncStore: vi.fn(),
	useAuthStore: vi.fn(),
	useVaultStore: vi.fn(),
	useRemoteVaultStore: vi.fn(),
	useSubscriptionStore: vi.fn(),
	useUIStore: vi.fn(),
	useEditorStore: vi.fn(),
}))

// Mock child panels to avoid complex deps
vi.mock("../../../features/sync/SyncLogsModal", () => ({
	SyncLogsModal: () => null,
}))
vi.mock("../../../features/sync/DeletedNotesPanel", () => ({
	DeletedNotesPanel: () => null,
}))
vi.mock("../../../features/sync/NoteHistoryPanel", () => ({
	NoteHistoryPanel: () => null,
}))
vi.mock("../../../features/sync/VaultLinkModal", () => ({
	VaultLinkModal: () => null,
}))

import {
	useAuthStore,
	useEditorStore,
	useRemoteVaultStore,
	useSubscriptionStore,
	useSyncStore,
	useUIStore,
	useVaultStore,
} from "@cortex/core"
import { SyncIndicator } from "../../../features/sync/SyncIndicator"

const mockVault = { path: "/vault", name: "Test Vault", uuid: "vault-id" }

function mockAllStores(overrides: {
	syncStore?: Partial<ReturnType<typeof useSyncStore>>
	authStore?: { authenticated?: boolean }
	vaultStore?: { vault?: typeof mockVault | null }
	remoteVaultStore?: { linkedVaultId?: string | null; syncEnabled?: boolean }
	subscriptionStore?: { block?: { code: string; message: string } | null }
	uiStore?: { openSettings?: ReturnType<typeof vi.fn> }
	editorStore?: { activeFilePath?: string | null }
}) {
	vi.mocked(useSyncStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const state = {
			engineState: "idle",
			syncingFiles: {},
			initialSyncProgress: null,
			initialSyncComplete: true,
			vekRequired: false,
			lastSyncedAt: null,
			error: null,
			...overrides.syncStore,
		}
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useAuthStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const state = { authenticated: false, ...(overrides.authStore ?? {}) }
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useVaultStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const state = { vault: mockVault, ...(overrides.vaultStore ?? {}) }
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useRemoteVaultStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const state = {
			linkedVaultId: "vault-remote-id",
			syncConfig: {
				enabled: overrides.remoteVaultStore?.syncEnabled ?? false,
				remoteVaultId: overrides.remoteVaultStore?.linkedVaultId ?? "vault-remote-id",
				selfHosted: false,
				serverUrl: "https://sync.example.com",
				offlineMode: false,
				selfHostedEnvironment: {},
			},
			...(overrides.remoteVaultStore ?? {}),
		}
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useSubscriptionStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const state = { block: null, ...(overrides.subscriptionStore ?? {}) }
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useUIStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const state = { openSettings: vi.fn(), ...(overrides.uiStore ?? {}) }
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useEditorStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const state = { activeFilePath: null, ...(overrides.editorStore ?? {}) }
		return selector ? selector(state) : state
	}) as never)
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("SyncIndicator", () => {
	describe("when vekRequired is true", () => {
		beforeEach(() => {
			mockAllStores({ syncStore: { vekRequired: true, engineState: "idle" } })
		})

		it("renders Unlock Required button", () => {
			render(<SyncIndicator />)
			expect(screen.getByText("Unlock Required")).toBeInTheDocument()
		})
	})

	describe("when engine is idle and user is authenticated without linked vault", () => {
		beforeEach(() => {
			mockAllStores({
				authStore: { authenticated: true },
				remoteVaultStore: { linkedVaultId: null, syncEnabled: true },
			})
		})

		it("renders Set up sync button", () => {
			render(<SyncIndicator />)
			expect(screen.getByText("Set up sync")).toBeInTheDocument()
		})

		it("calls openSettings('sync') when clicked", async () => {
			const openSettings = vi.fn()
			mockAllStores({
				authStore: { authenticated: true },
				remoteVaultStore: { linkedVaultId: null, syncEnabled: true },
				uiStore: { openSettings },
			})
			render(<SyncIndicator />)
			await userEvent.click(screen.getByText("Set up sync"))
			expect(openSettings).toHaveBeenCalledWith("sync")
		})
	})

	describe("when engine is idle and user is not authenticated", () => {
		beforeEach(() => {
			mockAllStores({})
		})

		it("renders nothing", () => {
			const { container } = render(<SyncIndicator />)
			expect(container).toBeEmptyDOMElement()
		})
	})

	describe("when engine is idle and sync is disabled", () => {
		it("renders nothing", () => {
			mockAllStores({
				authStore: { authenticated: true },
				remoteVaultStore: { linkedVaultId: null, syncEnabled: false },
			})
			const { container } = render(<SyncIndicator />)
			expect(container).toBeEmptyDOMElement()
		})
	})

	describe("when engine state is live", () => {
		beforeEach(() => {
			mockAllStores({ syncStore: { engineState: "live" } })
		})

		it("renders Synced", () => {
			render(<SyncIndicator />)
			expect(screen.getByText("Synced")).toBeInTheDocument()
		})
	})

	describe("when engine state is connecting", () => {
		beforeEach(() => {
			mockAllStores({ syncStore: { engineState: "connecting" } })
		})

		it("renders Connecting...", () => {
			render(<SyncIndicator />)
			expect(screen.getByText("Connecting...")).toBeInTheDocument()
		})
	})

	describe("when engine state is offline without prior sync", () => {
		beforeEach(() => {
			mockAllStores({ syncStore: { engineState: "offline", lastSyncedAt: null } })
		})

		it("renders Offline", () => {
			render(<SyncIndicator />)
			expect(screen.getByText("Offline")).toBeInTheDocument()
		})
	})

	describe("when engine state is offline with prior sync (polling active)", () => {
		beforeEach(() => {
			mockAllStores({ syncStore: { engineState: "offline", lastSyncedAt: Date.now() } })
		})

		it("renders Synced (polling mode)", () => {
			render(<SyncIndicator />)
			expect(screen.getByText("Synced")).toBeInTheDocument()
		})
	})

	describe("when engine state is denied", () => {
		beforeEach(() => {
			mockAllStores({ syncStore: { engineState: "denied" } })
		})

		it("renders Access Denied", () => {
			render(<SyncIndicator />)
			expect(screen.getByText("Access Denied")).toBeInTheDocument()
		})

		it("renders Plan Required when subscription is blocked", () => {
			mockAllStores({
				syncStore: { engineState: "denied" },
				subscriptionStore: {
					block: {
						code: "subscription_required",
						message: "A Cortex Cloud plan is required to sync with Cortex Cloud.",
					},
				},
			})
			render(<SyncIndicator />)
			expect(screen.getByText("Plan Required")).toBeInTheDocument()
		})
	})

	describe("when there is a sync error", () => {
		beforeEach(() => {
			mockAllStores({ syncStore: { engineState: "recovering", error: "Connection failed" } })
		})

		it("renders Sync Error", () => {
			render(<SyncIndicator />)
			expect(screen.getByText("Sync Error")).toBeInTheDocument()
		})
	})

	describe("when initial sync is in progress", () => {
		beforeEach(() => {
			mockAllStores({
				syncStore: {
					engineState: "live",
					initialSyncProgress: { total: 10, completed: 3 },
					initialSyncComplete: false,
				},
			})
		})

		it("renders syncing progress with file count", () => {
			render(<SyncIndicator />)
			expect(screen.getByText("Syncing 3/10 files...")).toBeInTheDocument()
		})
	})

	describe("when files are actively syncing", () => {
		beforeEach(() => {
			mockAllStores({
				syncStore: {
					engineState: "live",
					syncingFiles: { "/vault/a.md": "uploading", "/vault/b.md": "downloading" },
				},
			})
		})

		it("renders syncing file count", () => {
			render(<SyncIndicator />)
			expect(screen.getByText("Syncing 2 file(s)...")).toBeInTheDocument()
		})
	})
})
