import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SiteHeader } from "./SiteHeader"

describe("SiteHeader", () => {
	it("shows Account when the server confirms an authenticated session", async () => {
		const sessionLoader = vi.fn().mockResolvedValue({
			authenticated: true,
			session: {
				deviceId: "device-123",
				email: "writer@example.com",
				userId: "user-123",
			},
		})

		render(<SiteHeader sessionLoader={sessionLoader} />)

		expect(screen.getByRole("link", { name: "Login" }).getAttribute("href")).toBe(
			"/login?redirect=/account",
		)
		expect((await screen.findByRole("link", { name: "Account" })).getAttribute("href")).toBe(
			"/account",
		)
	})
})
