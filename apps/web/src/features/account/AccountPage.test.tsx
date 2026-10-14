import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AccountPage } from "./AccountPage"

const activeOverview = {
	authenticated: true as const,
	session: {
		email: "writer@example.com",
	},
	subscription: {
		available: true as const,
		status: {
			status: "active" as const,
			entitled: true,
			currentPeriodStart: "2026-06-01T00:00:00Z",
			currentPeriodEnd: "2026-07-01T00:00:00Z",
			entitlementExpiresAt: "2026-07-03T00:00:00Z",
			billingCycle: "MONTHLY",
			planProductId: "prod_123",
		},
	},
	devices: {
		available: true as const,
		devices: [
			{
				id: "device-web",
				name: "Cortex Web",
				type: "web",
				isCurrent: true,
				isRevoked: false,
				lastSeenAt: "2026-06-22T18:00:00Z",
				createdAt: "2026-06-01T10:00:00Z",
			},
			{
				id: "device-old",
				name: "Old laptop",
				type: "desktop",
				isCurrent: false,
				isRevoked: true,
				lastSeenAt: null,
				createdAt: "2026-05-01T10:00:00Z",
			},
		],
	},
	vaults: {
		available: true as const,
		vaults: [
			{
				name: "Writing",
				description: "Personal notes",
				role: "owner" as const,
				memberCount: 2,
				updatedAt: "2026-06-21T12:00:00Z",
			},
			{
				name: "Team",
				description: null,
				role: "editor" as const,
				memberCount: 5,
				updatedAt: "2026-06-20T12:00:00Z",
			},
		],
	},
}

describe("AccountPage", () => {
	it("redirects unauthenticated visitors to account login", async () => {
		const getOverview = vi.fn().mockResolvedValue({
			authenticated: false,
			redirectTo: "/login?redirect=/account",
		})
		const redirectTo = vi.fn()

		render(<AccountPage getOverview={getOverview} redirectTo={redirectTo} />)

		await waitFor(() => {
			expect(redirectTo).toHaveBeenCalledWith("/login?redirect=/account")
		})
		expect(screen.getByRole("heading", { name: /Taking you to sign in/i })).toBeTruthy()
	})

	it("renders plan, vaults and devices without exposing internal identifiers", async () => {
		const getOverview = vi.fn().mockResolvedValue(activeOverview)

		const { container } = render(<AccountPage getOverview={getOverview} />)

		expect(await screen.findByRole("heading", { level: 1, name: "Account" })).toBeTruthy()
		expect(screen.getByText("writer@example.com")).toBeTruthy()
		expect(screen.getByText("Active")).toBeTruthy()
		expect(screen.getByRole("heading", { name: "Hosted Sync" })).toBeTruthy()
		expect(screen.getByText("Monthly · Renews Jul 1, 2026")).toBeTruthy()
		expect(screen.queryByRole("link", { name: /Manage billing/i })).toBeNull()
		expect(screen.getByRole("heading", { name: "Synced vaults" })).toBeTruthy()
		expect(screen.getByRole("heading", { name: "Devices" })).toBeTruthy()
		expect(screen.getByText("1 signed in")).toBeTruthy()
		expect(screen.getByText("Cortex Web")).toBeTruthy()
		expect(screen.getByText("This device")).toBeTruthy()
		expect(screen.getByText("Old laptop")).toBeTruthy()
		expect(screen.getAllByText("Signed out").length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText("Writing")).toBeTruthy()
		expect(screen.getByText(/Personal notes · 2 members/)).toBeTruthy()
		expect(screen.getByText("Owner")).toBeTruthy()
		expect(screen.getByText("Team")).toBeTruthy()
		expect(screen.getByText("Editor")).toBeTruthy()
		expect(container.textContent).not.toMatch(/user-123|device-web|device-old|vault-123/i)
		expect(container.textContent).not.toMatch(/endpoint|POST \/|recurrences/i)
	})

	it("shows the free plan state with a hosted Sync CTA", async () => {
		const getOverview = vi.fn().mockResolvedValue({
			...activeOverview,
			subscription: {
				available: true,
				status: {
					status: "none",
					entitled: false,
					currentPeriodStart: null,
					currentPeriodEnd: null,
					entitlementExpiresAt: null,
					billingCycle: null,
					planProductId: null,
				},
			},
		})

		render(<AccountPage getOverview={getOverview} />)

		expect(await screen.findByText("Free")).toBeTruthy()
		expect(screen.getByText("Local vaults on every device")).toBeTruthy()
		expect(screen.getByRole("link", { name: /Turn on hosted Sync/i }).getAttribute("href")).toBe(
			"/billing",
		)
	})
	it("logs out through the server function and returns to login", async () => {
		const getOverview = vi.fn().mockResolvedValue(activeOverview)
		const logoutAction = vi.fn().mockResolvedValue({ ok: true })
		const redirectTo = vi.fn()

		render(
			<AccountPage getOverview={getOverview} logoutAction={logoutAction} redirectTo={redirectTo} />,
		)

		await screen.findAllByText("writer@example.com")
		fireEvent.click(screen.getByRole("button", { name: /Log out/i }))

		await waitFor(() => {
			expect(logoutAction).toHaveBeenCalledWith({ data: {} })
			expect(redirectTo).toHaveBeenCalledWith("/login?redirect=/account")
		})
	})

	it("shows compact unavailable and empty states without hiding account identity", async () => {
		const getOverview = vi.fn().mockResolvedValue({
			...activeOverview,
			devices: {
				available: false,
				message: "Devices are temporarily unavailable.",
			},
			vaults: {
				available: true,
				vaults: [],
			},
		})

		render(<AccountPage getOverview={getOverview} />)

		expect((await screen.findAllByText("writer@example.com")).length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText("Devices are temporarily unavailable.")).toBeTruthy()
		expect(screen.getByText("No synced vaults yet")).toBeTruthy()
	})
})
