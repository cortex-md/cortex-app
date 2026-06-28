import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
	fetchDevices,
	fetchRemoteVaults,
	openBillingPage,
	setupSyncSettingsMocks,
} from "./syncSettingsTestUtils"

const { SyncSection } = await import("../../../features/settings/SyncSettings")

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("Sync settings overview", () => {
	it("shows vault-link onboarding when authenticated and enabled without a link", async () => {
		setupSyncSettingsMocks({ authenticated: true, syncEnabled: true, linkedVaultId: null })
		render(<SyncSection />)

		expect(screen.getByText("Remote vault")).toBeInTheDocument()
		expect(screen.getByText("Link or create a remote vault to start syncing.")).toBeInTheDocument()
		await waitFor(() => expect(fetchRemoteVaults).toHaveBeenCalled())
	})

	it("shows useful linked vault metadata without exposing the remote id", () => {
		setupSyncSettingsMocks({
			authenticated: true,
			syncEnabled: true,
			linkedVaultId: "remote-vault-id",
			remoteVaults: [{ id: "remote-vault-id", name: "Team Notes", role: "owner" }],
			engineState: "live",
			lastSyncedAt: Date.now(),
			deviceEntries: [
				{ id: "one", revoked: false },
				{ id: "two", revoked: false },
				{ id: "old", revoked: true },
			],
			files: [
				{ name: "One.md", path: "/vault/One.md", isDir: false },
				{ name: "Two.MD", path: "/vault/Two.MD", isDir: false },
				{ name: "Assets", path: "/vault/Assets", isDir: true },
			],
		})

		render(<SyncSection />)

		expect(screen.getByText("Team Notes")).toBeInTheDocument()
		expect(screen.queryByText("remote-vault-id")).not.toBeInTheDocument()
		expect(screen.getByText("Synced")).toBeInTheDocument()
		expect(screen.getByText("Just now")).toBeInTheDocument()
		expect(screen.getByText("2 devices")).toBeInTheDocument()
		expect(screen.getByText("2 notes")).toBeInTheDocument()
		expect(screen.getByText("owner access")).toBeInTheDocument()
	})

	it("fetches devices only for an enabled linked overview with an empty device store", async () => {
		setupSyncSettingsMocks({
			authenticated: true,
			syncEnabled: true,
			linkedVaultId: "remote-vault-id",
			remoteVaults: [{ id: "remote-vault-id", name: "Team Notes", role: "owner" }],
		})

		const { rerender } = render(<SyncSection />)
		await waitFor(() => expect(fetchDevices).toHaveBeenCalledTimes(1))
		rerender(<SyncSection />)

		expect(fetchDevices).toHaveBeenCalledTimes(1)
	})

	it("opens the web billing page when Cortex Cloud entitlement is missing", async () => {
		setupSyncSettingsMocks({
			authenticated: true,
			syncEnabled: false,
			subscriptionBlock: {
				code: "subscription_required",
				message: "A Cortex Cloud plan is required to sync with Cortex Cloud.",
			},
		})

		render(<SyncSection />)

		expect(screen.getByText("Plan required")).toBeInTheDocument()
		expect(
			screen.getByText("A Cortex Cloud plan is required to sync with Cortex Cloud."),
		).toBeInTheDocument()
		screen.getByRole("button", { name: "Manage plan" }).click()
		await waitFor(() => expect(openBillingPage).toHaveBeenCalled())
	})
})
