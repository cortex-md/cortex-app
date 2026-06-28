import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BILLING_COMPLETION_URL, BILLING_RETURN_URL } from "../../lib/billingCheckout"
import { BillingPage } from "./BillingPage"

function setBillingLocation(path: string) {
	window.history.replaceState({}, "", path)
}

describe("BillingPage", () => {
	it("redirects missing web sessions to login", async () => {
		setBillingLocation("/billing")
		const fetcher = vi.fn<typeof fetch>()
		const redirectTo = vi.fn()
		const createSessionCheckout = vi.fn().mockResolvedValue({
			ok: false,
			code: "unauthenticated",
			redirectTo: "/login?redirect=/billing",
			message: "Sign in to continue to Cortex Sync checkout.",
		})

		render(
			<BillingPage
				createSessionCheckout={createSessionCheckout}
				fetcher={fetcher}
				redirectTo={redirectTo}
			/>,
		)

		await waitFor(() => {
			expect(redirectTo).toHaveBeenCalledWith("/login?redirect=/billing")
		})
		expect(createSessionCheckout).toHaveBeenCalledTimes(1)
		expect(fetcher).not.toHaveBeenCalled()
		expect(screen.queryByText(/Open this page from Cortex/i)).toBeNull()
	})

	it("creates a session checkout and redirects to AbacatePay", async () => {
		setBillingLocation("/billing")
		const redirectTo = vi.fn()
		const createSessionCheckout = vi.fn().mockResolvedValue({
			ok: true,
			checkoutUrl: "https://pay.example.com/checkout/123",
		})

		render(<BillingPage createSessionCheckout={createSessionCheckout} redirectTo={redirectTo} />)

		await waitFor(() => {
			expect(redirectTo).toHaveBeenCalledWith("https://pay.example.com/checkout/123")
		})
		expect(screen.getByRole("link", { name: /Continue to AbacatePay/i }).getAttribute("href")).toBe(
			"https://pay.example.com/checkout/123",
		)
	})

	it("redirects active subscribers to account without rendering checkout", async () => {
		setBillingLocation("/billing")
		const redirectTo = vi.fn()
		const createSessionCheckout = vi.fn().mockResolvedValue({
			ok: true,
			code: "subscription_active",
			redirectTo: "/account",
			message: "Your hosted Cortex Sync plan is already active.",
			subscription: {
				status: "active",
				entitled: true,
				currentPeriodStart: null,
				currentPeriodEnd: null,
				entitlementExpiresAt: null,
				billingCycle: null,
				planProductId: null,
			},
		})

		render(<BillingPage createSessionCheckout={createSessionCheckout} redirectTo={redirectTo} />)

		await waitFor(() => {
			expect(redirectTo).toHaveBeenCalledWith("/account")
		})
		expect(createSessionCheckout).toHaveBeenCalledTimes(1)
		expect(screen.queryByRole("link", { name: /Continue to AbacatePay/i })).toBeNull()
		expect(screen.getByRole("heading", { name: /Opening your account/i })).toBeTruthy()
	})

	it("does not restart checkout on rerender while a checkout is already in flight", async () => {
		setBillingLocation("/billing")
		const redirectTo = vi.fn()
		const pendingCheckout = new Promise<never>(() => {})
		const firstCheckout = vi.fn(() => pendingCheckout)
		const secondCheckout = vi.fn(() => pendingCheckout)

		const { rerender } = render(
			<BillingPage createSessionCheckout={firstCheckout} redirectTo={redirectTo} />,
		)

		await waitFor(() => {
			expect(firstCheckout).toHaveBeenCalledTimes(1)
		})

		rerender(<BillingPage createSessionCheckout={secondCheckout} redirectTo={redirectTo} />)

		expect(secondCheckout).not.toHaveBeenCalled()
		expect(redirectTo).not.toHaveBeenCalled()
	})

	it("keeps the desktop fragment fallback and scrubs URL context", async () => {
		setBillingLocation(
			"/billing#token=access-token&device_id=device-123&server_url=https%3A%2F%2Fsync.example.com",
		)
		const fetcher = vi.fn(
			async () =>
				new Response(JSON.stringify({ checkout_url: "https://pay.example.com/checkout/123" }), {
					headers: { "Content-Type": "application/json" },
					status: 200,
				}),
		)
		const createSessionCheckout = vi.fn()
		const redirectTo = vi.fn()

		render(
			<BillingPage
				createSessionCheckout={createSessionCheckout}
				fetcher={fetcher}
				redirectTo={redirectTo}
			/>,
		)

		await waitFor(() => {
			expect(fetcher).toHaveBeenCalledTimes(1)
		})
		const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
		expect(url).toBe("https://sync.example.com/subscription/v1/checkout")
		expect(init.method).toBe("POST")
		expect(init.headers).toMatchObject({
			Authorization: "Bearer access-token",
			"Content-Type": "application/json",
			"X-Device-ID": "device-123",
		})
		expect(JSON.parse(String(init.body))).toEqual({
			return_url: BILLING_RETURN_URL,
			completion_url: BILLING_COMPLETION_URL,
		})
		expect(createSessionCheckout).not.toHaveBeenCalled()
		expect(window.location.hash).toBe("")
		expect(window.location.pathname).toBe("/billing")
		await waitFor(() => {
			expect(redirectTo).toHaveBeenCalledWith("https://pay.example.com/checkout/123")
		})
	})

	it("shows retryable session checkout errors without claiming success", async () => {
		setBillingLocation("/billing")
		const createSessionCheckout = vi.fn().mockResolvedValue({
			ok: false,
			code: "checkout_unavailable",
			message: "subscription unavailable",
		})
		const redirectTo = vi.fn()

		render(<BillingPage createSessionCheckout={createSessionCheckout} redirectTo={redirectTo} />)

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain("subscription unavailable")
		})
		expect(redirectTo).not.toHaveBeenCalled()
		expect(screen.queryByRole("heading", { name: /Redirecting to checkout/i })).toBeNull()

		fireEvent.click(screen.getByRole("button", { name: /Try again/i }))

		await waitFor(() => {
			expect(createSessionCheckout).toHaveBeenCalledTimes(2)
		})
	})
})
