import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/core", () => ({
	resolveSyncServerUrl: vi.fn(
		(config?: { serverUrl?: string }) => config?.serverUrl ?? "http://localhost:8080",
	),
	useAuthStore: vi.fn(),
	useRemoteVaultStore: vi.fn(),
	useUIStore: vi.fn(),
}))

import { useAuthStore, useRemoteVaultStore, useUIStore } from "@cortex/core"
import { AuthModal } from "../../../features/auth/AuthModal"

const login = vi.fn().mockResolvedValue(undefined)
const register = vi.fn().mockResolvedValue(undefined)
const clearError = vi.fn()
const closeAuth = vi.fn()
const openSettings = vi.fn()

function setupMocks(
	overrides: {
		authInitialView?: "login" | "register"
		authReturnTo?: string | null
		loading?: boolean
		error?: string | null
	} = {},
) {
	vi.mocked(useUIStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const state = {
			authOpen: true,
			authInitialView: overrides.authInitialView ?? "login",
			authReturnTo: overrides.authReturnTo ?? null,
			closeAuth,
			openSettings,
		}
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useAuthStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const state = {
			login,
			register,
			loading: overrides.loading ?? false,
			error: overrides.error ?? null,
			clearError,
		}
		return selector ? selector(state) : state
	}) as never)

	vi.mocked(useRemoteVaultStore).mockImplementation(((selector?: (s: unknown) => unknown) => {
		const state = {
			syncConfig: {
				serverUrl: "https://sync.example.com",
			},
		}
		return selector ? selector(state) : state
	}) as never)
}

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	login.mockResolvedValue(undefined)
	register.mockResolvedValue(undefined)
})

describe("AuthModal", () => {
	it("switches from sign in to create account", async () => {
		setupMocks()
		render(<AuthModal />)

		await userEvent.click(screen.getByRole("tab", { name: "Create account" }))

		expect(screen.getByLabelText("Display name")).toBeInTheDocument()
		expect(screen.getByLabelText("Confirm password")).toBeInTheDocument()
	})

	it("submits login and returns to Sync settings", async () => {
		setupMocks({ authReturnTo: "sync" })
		render(<AuthModal />)

		await userEvent.type(
			screen.getByLabelText("Email", { selector: "#auth-login-email" }),
			"you@example.com",
		)
		await userEvent.type(
			screen.getByLabelText("Password", { selector: "#auth-login-password" }),
			"password123",
		)
		await userEvent.click(screen.getByText("Sign in", { selector: "button[type='submit']" }))

		await waitFor(() => {
			expect(login).toHaveBeenCalledWith(
				"you@example.com",
				"password123",
				"https://sync.example.com",
			)
		})
		expect(closeAuth).toHaveBeenCalled()
		expect(openSettings).toHaveBeenCalledWith("sync")
	})

	it("validates password confirmation before registering", async () => {
		setupMocks({ authInitialView: "register" })
		render(<AuthModal />)

		await userEvent.type(screen.getByLabelText("Display name"), "Jane Doe")
		await userEvent.type(
			screen.getByLabelText("Email", { selector: "#auth-register-email" }),
			"jane@example.com",
		)
		await userEvent.type(
			screen.getByLabelText("Password", { selector: "#auth-register-password" }),
			"password123",
		)
		await userEvent.type(screen.getByLabelText("Confirm password"), "different123")
		await userEvent.click(screen.getByText("Create account", { selector: "button[type='submit']" }))

		expect(screen.getByText("Passwords do not match")).toBeInTheDocument()
		expect(register).not.toHaveBeenCalled()
	})

	it("submits register when fields are valid", async () => {
		setupMocks({ authInitialView: "register" })
		render(<AuthModal />)

		await userEvent.type(screen.getByLabelText("Display name"), "Jane Doe")
		await userEvent.type(
			screen.getByLabelText("Email", { selector: "#auth-register-email" }),
			"jane@example.com",
		)
		await userEvent.type(
			screen.getByLabelText("Password", { selector: "#auth-register-password" }),
			"password123",
		)
		await userEvent.type(screen.getByLabelText("Confirm password"), "password123")
		await userEvent.click(screen.getByText("Create account", { selector: "button[type='submit']" }))

		await waitFor(() => {
			expect(register).toHaveBeenCalledWith(
				"jane@example.com",
				"password123",
				"Jane Doe",
				"https://sync.example.com",
			)
		})
		expect(closeAuth).toHaveBeenCalled()
	})
})
