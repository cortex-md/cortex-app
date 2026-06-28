import { getPlatform } from "@cortex/platform"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "../../stores/authStore"
import { createDefaultSyncConfig, useRemoteVaultStore } from "../../stores/remoteVaultStore"
import { useSyncStore } from "../../stores/syncStore"
import { useVaultStore } from "../../stores/vaultStore"

const logout = vi.fn().mockResolvedValue(undefined)
const stopSync = vi.fn().mockResolvedValue(undefined)
const updateSyncConfig = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
	vi.clearAllMocks()
	logout.mockResolvedValue(undefined)
	stopSync.mockResolvedValue(undefined)
	updateSyncConfig.mockResolvedValue(undefined)
	useAuthStore.setState({
		authenticated: true,
		user: {
			userId: "user-id",
			email: "jane@example.com",
			displayName: "Jane Doe",
		},
		loading: false,
		error: null,
		serverUrl: "https://sync.example.com",
	})
	useVaultStore.setState({
		vault: {
			uuid: "vault-id",
			path: "/vault",
			name: "Vault",
			fileCount: 1,
		},
	})
	useRemoteVaultStore.setState({
		syncConfig: {
			...createDefaultSyncConfig(),
			enabled: true,
			serverUrl: "https://sync.example.com",
		},
	})
	useSyncStore.setState({ stopSync })
	vi.mocked(getPlatform).mockReturnValue({
		auth: { logout },
		remoteVault: { updateSyncConfig },
	} as never)
})

describe("authStore", () => {
	it("stops and disables sync before signing out", async () => {
		await useAuthStore.getState().logout(false, "https://sync.example.com")

		expect(stopSync).toHaveBeenCalledTimes(1)
		expect(updateSyncConfig).toHaveBeenCalledWith("/vault", "enabled", false)
		expect(logout).toHaveBeenCalledWith("https://sync.example.com", false)
		expect(useRemoteVaultStore.getState().syncConfig.enabled).toBe(false)
		expect(useAuthStore.getState().authenticated).toBe(false)
		expect(useAuthStore.getState().user).toBeNull()
	})

	it("still clears the remote session when disabling sync fails", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
		updateSyncConfig.mockRejectedValueOnce(new Error("disk unavailable"))

		await useAuthStore.getState().logout(false, "https://sync.example.com")

		expect(logout).toHaveBeenCalledWith("https://sync.example.com", false)
		expect(useAuthStore.getState().authenticated).toBe(false)
		expect(consoleError).toHaveBeenCalled()
		consoleError.mockRestore()
	})
})
