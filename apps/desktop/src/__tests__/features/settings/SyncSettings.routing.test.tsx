import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
	openAuth,
	setSelfHosted,
	setSyncEnabled,
	setupSyncSettingsMocks,
} from "./syncSettingsTestUtils"

const { SyncSection } = await import("../../../features/settings/SyncSettings")

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("Sync settings routing", () => {
	it("hides the sync switch until a remote vault is linked", () => {
		setupSyncSettingsMocks({ authenticated: false, syncEnabled: false })
		render(<SyncSection />)

		expect(screen.queryByRole("switch", { name: "Sync this vault" })).not.toBeInTheDocument()
		expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
		expect(screen.queryByText("Connection")).not.toBeInTheDocument()
		expect(setSyncEnabled).not.toHaveBeenCalled()
	})

	it("opens authentication from the signed-out notice", async () => {
		setupSyncSettingsMocks({ authenticated: false, syncEnabled: true })
		render(<SyncSection />)

		await userEvent.click(screen.getByRole("button", { name: "Sign in" }))

		expect(openAuth).toHaveBeenCalledWith("login", "sync")
	})

	it("routes preferences and members to their focused pages", () => {
		setupSyncSettingsMocks({
			authenticated: true,
			syncEnabled: true,
			linkedVaultId: "remote-vault-id",
			remoteVaults: [{ id: "remote-vault-id", name: "Team Notes", role: "owner" }],
		})
		const { rerender } = render(<SyncSection view="preferences" />)

		expect(screen.getByText("Content")).toBeInTheDocument()
		expect(screen.getByRole("switch", { name: "Images" })).toBeInTheDocument()
		expect(screen.getByRole("switch", { name: "Bookmarks" })).toBeInTheDocument()
		expect(screen.getByText("Excluded paths panel")).toBeInTheDocument()

		rerender(<SyncSection view="members" />)
		expect(screen.getByText("Members panel")).toBeInTheDocument()
	})

	it("keeps self-host configuration available while signed out", async () => {
		setupSyncSettingsMocks({ authenticated: false, syncEnabled: false, selfHosted: false })
		render(<SyncSection view="self-host" />)

		const selfHostedSwitch = screen.getByRole("switch", { name: "Use a self-hosted server" })
		expect(selfHostedSwitch).toBeEnabled()
		await userEvent.click(selfHostedSwitch)

		expect(setSelfHosted).toHaveBeenCalledWith("/vault", true)
	})
})
