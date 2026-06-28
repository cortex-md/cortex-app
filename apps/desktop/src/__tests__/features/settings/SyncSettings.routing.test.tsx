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
	it("requires sign-in before users can enable sync", async () => {
		setupSyncSettingsMocks({ authenticated: false, syncEnabled: false })
		render(<SyncSection />)

		expect(screen.getByText("Enable sync for this vault")).toBeInTheDocument()
		expect(screen.getByText("Sign in before enabling sync")).toBeInTheDocument()
		expect(screen.queryByText("Connection")).not.toBeInTheDocument()
		expect(screen.getByRole("switch", { name: "Enable sync for this vault" })).toBeDisabled()

		await userEvent.click(screen.getByRole("switch", { name: "Enable sync for this vault" }))

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
		expect(screen.getByRole("switch", { name: "Ignore images" })).toBeInTheDocument()
		expect(screen.getByRole("switch", { name: "Bookmarks" })).toBeInTheDocument()
		expect(screen.getByText("Excluded paths panel")).toBeInTheDocument()

		rerender(<SyncSection view="members" />)
		expect(screen.getByText("Members panel")).toBeInTheDocument()
	})

	it("keeps self-host configuration available while signed out", async () => {
		setupSyncSettingsMocks({ authenticated: false, syncEnabled: false, selfHosted: false })
		render(<SyncSection view="self-host" />)

		const selfHostedSwitch = screen.getByRole("switch", { name: "Self-hosted sync" })
		expect(selfHostedSwitch).toBeEnabled()
		await userEvent.click(selfHostedSwitch)

		expect(setSelfHosted).toHaveBeenCalledWith("/vault", true)
	})
})
