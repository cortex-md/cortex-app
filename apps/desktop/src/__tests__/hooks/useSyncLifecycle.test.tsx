import {
	DEFAULT_CLOUD_SYNC_SERVER_URL,
	useAuthStore,
	useRemoteVaultStore,
	useSubscriptionStore,
	useSyncLogStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSyncLifecycle } from "../../hooks/useSyncLifecycle"

const mockVault = { path: "/vault", name: "Test", uuid: "vault-id", fileCount: 0 }
const startSync = vi.fn().mockResolvedValue(undefined)
const stopSync = vi.fn().mockResolvedValue(undefined)
const loadLink = vi.fn().mockResolvedValue(undefined)
const checkAuth = vi.fn().mockResolvedValue(undefined)
const logFn = vi.fn()

interface SyncLifecycleState {
	authenticated?: boolean
	syncEnabled?: boolean
	serverUrl?: string
	authServerUrl?: string
	selfHosted?: boolean
	vault?: typeof mockVault | null
	linkedVaultId?: string | null
	subscriptionBlock?: { code: "subscription_required"; message: string } | null
}

function getExpectedServerUrl(state: SyncLifecycleState): string {
	return state.selfHosted ? (state.serverUrl ?? "") : DEFAULT_CLOUD_SYNC_SERVER_URL
}

function setupState(state: SyncLifecycleState) {
	act(() => {
		useSyncLogStore.setState({ log: logFn })
		useSyncStore.setState({ startSync, stopSync })
		useVaultStore.setState({ vault: state.vault ?? null })
		useAuthStore.setState({
			authenticated: state.authenticated ?? false,
			serverUrl: state.authServerUrl ?? getExpectedServerUrl(state),
			checkAuth,
		})
		useRemoteVaultStore.setState({
			linkedVaultId: state.linkedVaultId ?? null,
			loadLink,
			syncConfig: {
				enabled: state.syncEnabled ?? true,
				remoteVaultId: state.linkedVaultId ?? null,
				selfHosted: state.selfHosted ?? false,
				serverUrl: state.serverUrl ?? "https://sync.example.com",
				offlineMode: false,
				selfHostedEnvironment: {},
			},
		})
		useSubscriptionStore.setState({ block: state.subscriptionBlock ?? null })
	})
}

beforeEach(() => {
	setupState({})
	vi.clearAllMocks()
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("useSyncLifecycle", () => {
	describe("when all conditions are met", () => {
		beforeEach(() => {
			setupState({
				authenticated: true,
				syncEnabled: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
			})
		})

		it("calls startSync with vaultId, vaultPath, and serverUrl", () => {
			renderHook(() => useSyncLifecycle())
			expect(startSync).toHaveBeenCalledWith(
				"remote-vault-id",
				mockVault.path,
				DEFAULT_CLOUD_SYNC_SERVER_URL,
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
			setupState({ authenticated: false, vault: mockVault, linkedVaultId: "id" })
			renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()
		})
	})

	describe("when self-hosted sync is enabled without authentication", () => {
		it("does not call startSync before sign-in", () => {
			setupState({
				authenticated: false,
				syncEnabled: true,
				serverUrl: "https://self.hosted.com",
				selfHosted: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()
		})
	})

	describe("when self-hosted sync is authenticated", () => {
		it("starts with the vault-scoped server URL", () => {
			setupState({
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
			setupState({
				authenticated: true,
				syncEnabled: true,
				serverUrl: "https://self.hosted.com",
				selfHosted: true,
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
			setupState({
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
		const planBlock = { code: "subscription_required" as const, message: "Plan required" }

		it("does not start sync while a plan block is active", () => {
			setupState({
				authenticated: true,
				syncEnabled: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
				subscriptionBlock: planBlock,
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()
		})

		it("stops active cloud sync when a plan block appears", () => {
			setupState({
				authenticated: true,
				syncEnabled: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).toHaveBeenCalled()

			act(() => {
				useSubscriptionStore.setState({ block: planBlock })
			})

			expect(stopSync).toHaveBeenCalled()
		})

		it("starts cloud sync after the plan block is cleared", () => {
			setupState({
				authenticated: true,
				syncEnabled: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
				subscriptionBlock: planBlock,
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()

			act(() => {
				useSubscriptionStore.setState({ block: null })
			})

			expect(startSync).toHaveBeenCalledWith(
				"remote-vault-id",
				mockVault.path,
				DEFAULT_CLOUD_SYNC_SERVER_URL,
				true,
			)
		})

		it("ignores subscription blocks for self-hosted sync", () => {
			setupState({
				authenticated: true,
				syncEnabled: true,
				serverUrl: "https://self.hosted.com",
				selfHosted: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
				subscriptionBlock: planBlock,
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
			setupState({
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
			setupState({
				authenticated: true,
				syncEnabled: true,
				vault: mockVault,
				linkedVaultId: null,
			})
			renderHook(() => useSyncLifecycle())
			expect(startSync).not.toHaveBeenCalled()
		})
	})

	describe("cleanup on unmount", () => {
		it("calls stopSync when sync was active and component unmounts", () => {
			setupState({
				authenticated: true,
				syncEnabled: true,
				vault: mockVault,
				linkedVaultId: "remote-vault-id",
			})
			const { unmount } = renderHook(() => useSyncLifecycle())
			expect(startSync).toHaveBeenCalled()
			unmount()
			expect(stopSync).toHaveBeenCalled()
		})

		it("does NOT call stopSync on unmount when sync was never started", () => {
			setupState({ authenticated: false, vault: null, linkedVaultId: null })
			const { unmount } = renderHook(() => useSyncLifecycle())
			unmount()
			expect(stopSync).not.toHaveBeenCalled()
		})
	})

	describe("loadLink behavior", () => {
		it("calls loadLink with vault path when vault is open", () => {
			setupState({ vault: mockVault, linkedVaultId: null })
			renderHook(() => useSyncLifecycle())
			expect(loadLink).toHaveBeenCalledWith(mockVault.path)
		})

		it("calls loadLink with empty string when vault is null", () => {
			setupState({ vault: null, linkedVaultId: null })
			renderHook(() => useSyncLifecycle())
			expect(loadLink).toHaveBeenCalledWith("")
		})
	})
})
