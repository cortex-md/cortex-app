import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/core", () => ({
	requiresCloudEntitlement: vi.fn(
		(config?: { selfHosted?: boolean }) => config?.selfHosted !== true,
	),
	resolveSyncServerUrl: vi.fn(
		(config?: { serverUrl?: string }) => config?.serverUrl ?? "http://localhost:8080",
	),
	useVaultStore: vi.fn(),
	useAuthStore: vi.fn(),
	useRemoteVaultStore: vi.fn(),
	useSyncStore: vi.fn(),
	useSubscriptionStore: vi.fn(),
	useSyncLogStore: {
		getState: vi.fn(() => ({ log: vi.fn() })),
	},
}))

import {
	useAuthStore,
	useRemoteVaultStore,
	useSubscriptionStore,
	useSyncLogStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import { useSyncLifecycle } from "../../hooks/useSyncLifecycle"

const mockVault = { path: "/vault", name: "Test", uuid: "vault-id" }
const startSync = vi.fn().mockResolvedValue(undefined)
const stopSync = vi.fn().mockResolvedValue(undefined)
const loadLink = vi.fn().mockResolvedValue(undefined)
const checkAuth = vi.fn().mockResolvedValue(undefined)
const logFn = vi.fn()

function setupMocks(overrides: {
	authenticated?: boolean
	syncEnabled?: boolean
	serverUrl?: string
	authServerUrl?: string
	selfHosted?: boolean
	vault?: typeof mockVault | null
	linkedVaultId?: string | null
	subscriptionBlock?: { code: string; message: string } | null
}) {
	vi.mocked(useSyncLogStore.getState).mockReturnValue({ log: logFn } as never)

	vi.mocked(useVaultStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const state = { vault: overrides.vault ?? null }
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useAuthStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const serverUrl = overrides.serverUrl ?? "https://sync.example.com"
		const state = {
			authenticated: overrides.authenticated ?? false,
			serverUrl: overrides.authServerUrl ?? serverUrl,
			checkAuth,
		}
		return selector ? selector(state) : state
	}) as never)

	const remoteVaultState = {
		linkedVaultId: overrides.linkedVaultId ?? null,
		loadLink,
		syncConfig: {
			enabled: overrides.syncEnabled ?? true,
			remoteVaultId: overrides.linkedVaultId ?? null,
			selfHosted: overrides.selfHosted ?? false,
			serverUrl: overrides.serverUrl ?? "https://sync.example.com",
			offlineMode: false,
			selfHostedEnvironment: {},
		},
	}
	vi.mocked(useRemoteVaultStore).mockImplementation(((
		selector?: (state: typeof remoteVaultState) => unknown,
	) => (selector ? selector(remoteVaultState) : remoteVaultState)) as never)

	const syncState = { startSync, stopSync }
	vi.mocked(useSyncStore).mockImplementation(((selector?: (state: typeof syncState) => unknown) =>
		selector ? selector(syncState) : syncState) as never)

	const subscriptionState = { block: overrides.subscriptionBlock ?? null }
	vi.mocked(useSubscriptionStore).mockImplementation(((
		selector?: (state: typeof subscriptionState) => unknown,
	) => (selector ? selector(subscriptionState) : subscriptionState)) as never)
}

afterEach(() => {
	cleanup()
	startSync.mockClear()
	stopSync.mockClear()
	loadLink.mockClear()
	checkAuth.mockClear()
	logFn.mockClear()
})

describe("useSyncLifecycle", () => {
	describe("when all conditions are met", () => {
		beforeEach(() => {
			setupMocks({
				authenticated: true,
				syncEnabled: true,
				serverUrl: "https://sync.example.com",
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
			})
		})

		it("calls startSync with vaultId, vaultPath, and serverUrl", () => {
			renderHook(() => useSyncLifecycle())
			expect(startSync).toHaveBeenCalledWith(
				"remote-vault-id",
				mockVault.path,
				"https://sync.example.com",
				true,
			)
		})

		it("logs 'starting sync' to syncLogStore", () => {
			renderHook(() => useSyncLifecycle())
			expect(logFn).toHaveBeenCalledWith(
				"info",
				expect.stringContaining("starting sync"),
				expect.any(Object),
			)
		})
	})

	describe("when user is not authenticated", () => {
		it("does not call startSync", () => {
			setupMocks({ authenticated: false, vault: mockVault, linkedVaultId: "id" })
			renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()
		})
	})

	describe("when self-hosted sync is enabled without authentication", () => {
		it("does not call startSync before sign-in", () => {
			setupMocks({
				authenticated: false,
				syncEnabled: true,
				serverUrl: "https://self.hosted.com",
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()
		})
	})

	describe("when self-hosted sync is authenticated", () => {
		it("starts with the vault-scoped server URL", () => {
			setupMocks({
				authenticated: true,
				syncEnabled: true,
				serverUrl: "https://self.hosted.com",
				selfHosted: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).toHaveBeenCalledWith(
				"remote-vault-id",
				mockVault.path,
				"https://self.hosted.com",
				false,
			)
		})
	})

	describe("when auth belongs to another server", () => {
		it("does not call startSync", () => {
			setupMocks({
				authenticated: true,
				syncEnabled: true,
				serverUrl: "https://self.hosted.com",
				authServerUrl: "https://sync.example.com",
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()
		})
	})

	describe("when syncEnabled is false", () => {
		it("does not call startSync", () => {
			setupMocks({
				authenticated: true,
				syncEnabled: false,
				vault: mockVault,
				linkedVaultId: "id",
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()
		})
	})

	describe("when cloud subscription is blocked", () => {
		it("does not start sync while a plan block is active", () => {
			setupMocks({
				authenticated: true,
				syncEnabled: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
				subscriptionBlock: {
					code: "subscription_required",
					message: "Plan required",
				},
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()
		})

		it("stops active cloud sync when a plan block appears", () => {
			setupMocks({
				authenticated: true,
				syncEnabled: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
				subscriptionBlock: null,
			})
			const { rerender } = renderHook(() => useSyncLifecycle())
			expect(startSync).toHaveBeenCalled()

			setupMocks({
				authenticated: true,
				syncEnabled: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
				subscriptionBlock: {
					code: "subscription_required",
					message: "Plan required",
				},
			})
			rerender()

			expect(stopSync).toHaveBeenCalled()
		})

		it("starts cloud sync after the plan block is cleared", () => {
			setupMocks({
				authenticated: true,
				syncEnabled: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
				subscriptionBlock: {
					code: "subscription_required",
					message: "Plan required",
				},
			})
			const { rerender } = renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()

			setupMocks({
				authenticated: true,
				syncEnabled: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
				subscriptionBlock: null,
			})
			rerender()

			expect(startSync).toHaveBeenCalledWith(
				"remote-vault-id",
				mockVault.path,
				"https://sync.example.com",
				true,
			)
		})

		it("ignores subscription blocks for self-hosted sync", () => {
			setupMocks({
				authenticated: true,
				syncEnabled: true,
				serverUrl: "https://self.hosted.com",
				selfHosted: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
				subscriptionBlock: {
					code: "subscription_required",
					message: "Plan required",
				},
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).toHaveBeenCalledWith(
				"remote-vault-id",
				mockVault.path,
				"https://self.hosted.com",
				false,
			)
		})
	})

	describe("when vault is null", () => {
		it("does not call startSync", () => {
			setupMocks({
				authenticated: true,
				syncEnabled: true,
				vault: null,
				linkedVaultId: "id",
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()
		})
	})

	describe("when linkedVaultId is null", () => {
		it("does not call startSync", () => {
			setupMocks({
				authenticated: true,
				syncEnabled: true,
				vault: mockVault,
				linkedVaultId: null,
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()
		})
	})

	describe("when serverUrl is empty", () => {
		it("does not call startSync", () => {
			setupMocks({
				authenticated: true,
				syncEnabled: true,
				serverUrl: "",
				vault: mockVault,
				linkedVaultId: "id",
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()
		})
	})

	describe("cleanup on unmount", () => {
		it("calls stopSync when sync was active and component unmounts", () => {
			setupMocks({
				authenticated: true,
				syncEnabled: true,
				serverUrl: "https://sync.example.com",
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
			})
			const { unmount } = renderHook(() => useSyncLifecycle())
			expect(startSync).toHaveBeenCalled()
			unmount()
			expect(stopSync).toHaveBeenCalled()
		})

		it("does NOT call stopSync on unmount when sync was never started", () => {
			setupMocks({ authenticated: false, vault: null, linkedVaultId: null })
			const { unmount } = renderHook(() => useSyncLifecycle())
			unmount()
			expect(stopSync).not.toHaveBeenCalled()
		})
	})

	describe("loadLink behavior", () => {
		it("calls loadLink with vault path when vault is open", () => {
			setupMocks({ vault: mockVault, linkedVaultId: null })
			renderHook(() => useSyncLifecycle())
			expect(loadLink).toHaveBeenCalledWith(mockVault.path)
		})

		it("calls loadLink with empty string when vault is null", () => {
			setupMocks({ vault: null, linkedVaultId: null })
			renderHook(() => useSyncLifecycle())
			expect(loadLink).toHaveBeenCalledWith("")
		})
	})
})
