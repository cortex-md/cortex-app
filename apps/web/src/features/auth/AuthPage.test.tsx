import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AuthPage } from "./AuthPage"

function setAuthLocation(path: string) {
	window.history.replaceState({}, "", path)
}

describe("AuthPage", () => {
	it("renders a minimal login form with an accessible route switch", () => {
		setAuthLocation("/login?redirect=/billing")

		render(<AuthPage mode="login" />)

		expect(screen.getByRole("heading", { name: "Sign in to Cortex" })).toBeTruthy()
		expect(screen.getByLabelText("Email")).toBeTruthy()
		expect(screen.getByLabelText("Password")).toBeTruthy()
		expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy()
		expect(screen.getByText("Don't have an account?")).toBeTruthy()
		expect(
			screen
				.getAllByRole("link", { name: "Create account" })
				.every((link) => link.getAttribute("href") === "/signup?redirect=%2Fbilling"),
		).toBe(true)
	})

	it("renders signup-specific fields and copy", () => {
		setAuthLocation("/signup?redirect=/billing")

		render(<AuthPage mode="signup" />)

		expect(screen.getByRole("heading", { name: "Create your Cortex account" })).toBeTruthy()
		expect(screen.getByLabelText("Name")).toBeTruthy()
		expect(screen.getByLabelText("Email")).toBeTruthy()
		expect(screen.getByLabelText("Password")).toBeTruthy()
		expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy()
		expect(
			screen
				.getAllByRole("link", { name: "Sign in" })
				.every((link) => link.getAttribute("href") === "/login?redirect=%2Fbilling"),
		).toBe(true)
	})

	it("toggles password visibility with a 40px hit area", () => {
		setAuthLocation("/login")

		render(<AuthPage mode="login" />)

		const passwordInput = screen.getByLabelText("Password")
		const toggle = screen.getByRole("button", { name: "Show password" })

		expect(passwordInput.getAttribute("type")).toBe("password")
		expect(toggle.className).toContain("size-10")

		fireEvent.click(toggle)

		expect(passwordInput.getAttribute("type")).toBe("text")
		expect(screen.getByRole("button", { name: "Hide password" })).toBeTruthy()
	})

	it("shows server errors without redirecting", async () => {
		setAuthLocation("/login?redirect=/billing")
		const loginAction = vi.fn().mockResolvedValue({
			ok: false,
			message: "Email or password is incorrect.",
		})
		const redirectTo = vi.fn()

		render(<AuthPage mode="login" loginAction={loginAction} redirectTo={redirectTo} />)

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "writer@example.com" },
		})
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "wrong-password" },
		})
		fireEvent.submit(
			screen.getByRole("button", { name: "Sign in" }).closest("form") as HTMLFormElement,
		)

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain("Email or password is incorrect.")
		})
		expect(redirectTo).not.toHaveBeenCalled()
	})

	it("blocks duplicate submissions while auth is in flight", async () => {
		setAuthLocation("/login?redirect=/billing")
		let resolveLogin:
			| ((value: {
					ok: true
					redirectTo: string
					session: { deviceId: string; email: string; userId: string }
			  }) => void)
			| undefined
		const loginAction = vi.fn(
			() =>
				new Promise<{
					ok: true
					redirectTo: string
					session: { deviceId: string; email: string; userId: string }
				}>((resolve) => {
					resolveLogin = resolve
				}),
		)
		const redirectTo = vi.fn()

		render(<AuthPage mode="login" loginAction={loginAction} redirectTo={redirectTo} />)

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "writer@example.com" },
		})
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "correct-password" },
		})

		const form = screen.getByRole("button", { name: "Sign in" }).closest("form") as HTMLFormElement
		fireEvent.submit(form)
		fireEvent.submit(form)

		expect(loginAction).toHaveBeenCalledTimes(1)
		expect(screen.getByRole("button", { name: /Signing in/i }).hasAttribute("disabled")).toBe(true)

		resolveLogin?.({
			ok: true,
			redirectTo: "/billing",
			session: {
				deviceId: "device-123",
				email: "writer@example.com",
				userId: "user-123",
			},
		})

		await waitFor(() => {
			expect(redirectTo).toHaveBeenCalledWith("/billing")
		})
	})

	it("submits signup and redirects to the sanitized target", async () => {
		setAuthLocation("/signup?redirect=https%3A%2F%2Fevil.example")
		const signupAction = vi.fn().mockResolvedValue({
			ok: true,
			redirectTo: "/account",
			session: {
				deviceId: "device-123",
				email: "writer@example.com",
				userId: "user-123",
			},
		})
		const redirectTo = vi.fn()

		render(<AuthPage mode="signup" signupAction={signupAction} redirectTo={redirectTo} />)

		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Writer" },
		})
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "writer@example.com" },
		})
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "correct-password" },
		})
		fireEvent.submit(
			screen.getByRole("button", { name: "Create account" }).closest("form") as HTMLFormElement,
		)

		await waitFor(() => {
			expect(signupAction).toHaveBeenCalledWith({
				data: {
					displayName: "Writer",
					email: "writer@example.com",
					password: "correct-password",
					redirectTo: "/account",
				},
			})
		})
		expect(redirectTo).toHaveBeenCalledWith("/account")
	})
})
