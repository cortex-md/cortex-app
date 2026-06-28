import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
	getSyncSettingsPlatformMocks,
	setupSyncSettingsMocks,
	updateSelfHostedEnvironment,
} from "./syncSettingsTestUtils"

const platformMocks = getSyncSettingsPlatformMocks()
const { SyncSection } = await import("../../../features/settings/SyncSettings")

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

describe("Self-hosted sync settings", () => {
	it("shows four closed environment groups and keeps one open at a time", async () => {
		setupSyncSettingsMocks({ authenticated: false, syncEnabled: true, selfHosted: true })
		render(<SyncSection view="self-host" />)

		for (const groupName of ["Server", "Database", "Authentication", "Storage"]) {
			expect(screen.getByRole("button", { name: groupName })).toHaveAttribute(
				"aria-expanded",
				"false",
			)
		}
		const serverTrigger = screen.getByRole("button", { name: "Server" })
		const databaseTrigger = screen.getByRole("button", { name: "Database" })
		await userEvent.click(serverTrigger)
		expect(screen.getByRole("textbox", { name: "Environment" })).toBeInTheDocument()
		expect(screen.getByRole("textbox", { name: "Trust proxy headers" })).toBeInTheDocument()
		await userEvent.click(databaseTrigger)
		expect(serverTrigger).toHaveAttribute("aria-expanded", "false")
		expect(databaseTrigger).toHaveAttribute("aria-expanded", "true")
		expect(screen.queryByRole("textbox", { name: "Environment" })).not.toBeInTheDocument()
	})

	it("updates environment values and stores secrets in the keychain", async () => {
		setupSyncSettingsMocks({
			authenticated: false,
			syncEnabled: true,
			selfHosted: true,
			selfHostedEnvironment: { CORTEX_DATABASE_URL: "postgres://old" },
		})
		render(<SyncSection view="self-host" />)

		await userEvent.click(screen.getByRole("button", { name: "Database" }))
		fireEvent.change(screen.getByRole("textbox", { name: "PostgreSQL URL" }), {
			target: { value: "postgres://new" },
		})
		await waitFor(() =>
			expect(updateSelfHostedEnvironment).toHaveBeenCalledWith(
				"/vault",
				"CORTEX_DATABASE_URL",
				"postgres://new",
			),
		)

		await userEvent.click(screen.getByRole("button", { name: "Authentication" }))
		fireEvent.change(screen.getByLabelText("Access token secret"), {
			target: { value: "secret-value" },
		})
		await waitFor(() =>
			expect(platformMocks.keychainSet).toHaveBeenCalledWith(
				"sync-env-secret:vault-id:CORTEX_AUTH_ACCESS_TOKEN_SECRET",
				"secret-value",
			),
		)
	})

	it("copies and exports the environment file", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined)
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		})
		setupSyncSettingsMocks({ authenticated: false, syncEnabled: true, selfHosted: true })
		render(<SyncSection view="self-host" />)

		await userEvent.click(screen.getByRole("button", { name: "Copy .env" }))
		expect(writeText).toHaveBeenCalledWith(expect.stringContaining("CORTEX_SERVER_ENV=production"))
		expect(writeText).toHaveBeenCalledWith(expect.stringContaining("CORTEX_STORAGE_BACKEND=r2"))
		expect(writeText).toHaveBeenCalledWith(
			expect.stringContaining("CORTEX_STORAGE_SECRET_KEY=replace-with-storage-secret-key"),
		)

		await userEvent.click(screen.getByRole("button", { name: "Export" }))
		expect(platformMocks.writeFile).toHaveBeenCalledWith(
			"/exports/.env",
			expect.stringContaining("CORTEX_SERVER_ENV=production"),
		)
		expect(platformMocks.writeFile).toHaveBeenCalledWith(
			"/exports/.env",
			expect.stringContaining("CORTEX_STORAGE_BACKEND=r2"),
		)
	})

	it("does not write an environment file when native export is cancelled", async () => {
		platformMocks.saveFile.mockResolvedValueOnce(null)
		setupSyncSettingsMocks({ authenticated: false, syncEnabled: true, selfHosted: true })
		render(<SyncSection view="self-host" />)

		await userEvent.click(screen.getByRole("button", { name: "Export" }))

		expect(platformMocks.writeFile).not.toHaveBeenCalled()
	})
})
