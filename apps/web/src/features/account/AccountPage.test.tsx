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
				name: "Cortex Web",
				type: "web",
				isCurrent: true,
				isRevoked: false,
				lastSeenAt: "2026-06-22T18:00:00Z",
				createdAt: "2026-06-01T10:00:00Z",
			},
			{
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

	it("renders an organized dashboard without exposing internal identifiers", async () => {
		const getOverview = vi.fn().mockResolvedValue(activeOverview)

		const { container } = render(<AccountPage getOverview={getOverview} />)

		expect(await screen.findByRole("heading", { level: 1, name: "Account" })).toBeTruthy()
		expect(screen.getAllByText("writer@example.com").length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText("Plan")).toBeTruthy()
		expect(screen.getAllByText("Vaults").length).toBeGreaterThanOrEqual(2)
		expect(screen.getAllByText("Devices").length).toBeGreaterThanOrEqual(2)
		expect(screen.getAllByText("Account").length).toBeGreaterThanOrEqual(2)
		expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText("Monthly")).toBeTruthy()
		expect(screen.getByText("Cortex Web")).toBeTruthy()
		expect(screen.getByText("This device")).toBeTruthy()
		expect(screen.getByText("Old laptop")).toBeTruthy()
		expect(screen.getByText("Revoked")).toBeTruthy()
		expect(screen.getByText("Writing")).toBeTruthy()
		expect(screen.getByText("Personal notes")).toBeTruthy()
		expect(screen.getByText("Owner")).toBeTruthy()
		expect(screen.getByText("Team")).toBeTruthy()
		expect(screen.getByText("Editor")).toBeTruthy()
		expect(container.textContent).not.toMatch(/user-123|device-123|vault-123|owner-123/i)
		expect(container.textContent).not.toMatch(/user id|device id|vault id|owner id/i)
		expect(container.textContent).not.toMatch(/endpoint|POST \/|recurrences/i)
	})

	it("shows a single inactive plan state with an upgrade CTA", async () => {
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

		expect(await screen.findByText("Inactive")).toBeTruthy()
		expect(screen.getAllByText("Inactive")).toHaveLength(1)
		expect(screen.getByRole("link", { name: /Upgrade hosted Sync/i }).getAttribute("href")).toBe(
			"/billing",
		)
		expect(screen.queryByText(/No hosted plan/i)).toBeNull()
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
		expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(1)
		expect(screen.getByText("Devices are temporarily unavailable.")).toBeTruthy()
		expect(screen.getByText("Vaults created or joined from Cortex will appear here.")).toBeTruthy()
	})
})
