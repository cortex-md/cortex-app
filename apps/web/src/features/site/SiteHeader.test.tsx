import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SiteHeader } from "./SiteHeader"

vi.mock("@tanstack/react-router", () => ({
	useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
		select({ location: { pathname: "/sync" } }),
}))

describe("SiteHeader", () => {
	it("shows Account with the email initial when the server confirms an authenticated session", async () => {
		const sessionLoader = vi.fn().mockResolvedValue({
			authenticated: true,
			session: {
				deviceId: "device-123",
				email: "writer@example.com",
				userId: "user-123",
			},
		})

		render(<SiteHeader sessionLoader={sessionLoader} />)

		expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
			"/login?redirect=/account",
		)
		const account = await screen.findByRole("link", { name: /Account/ })
		expect(account.getAttribute("href")).toBe("/account")
		expect(account.textContent).toContain("W")
		expect(screen.getByRole("link", { name: "Sync" }).getAttribute("aria-current")).toBe("page")
	})
})
