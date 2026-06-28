import { describe, expect, it, vi } from "vitest"
import type { AuthSession } from "./auth"
import { createCheckoutFromAuthSession, normalizeSubscriptionStatus } from "./billing"

const session: AuthSession = {
	accessToken: "access-token",
	deviceId: "device-123",
	email: "writer@example.com",
	refreshToken: "refresh-token",
	userId: "user-123",
}

function jsonResponse(payload: unknown, status = 200) {
	return new Response(JSON.stringify(payload), {
		headers: { "Content-Type": "application/json" },
		status,
	})
}

describe("createCheckoutFromAuthSession", () => {
	it("redirects unauthenticated visitors to login", async () => {
		const result = await createCheckoutFromAuthSession({ session: null })

		expect(result).toEqual({
			ok: false,
			code: "unauthenticated",
			redirectTo: "/login?redirect=/billing",
			message: "Sign in to continue to Cortex Sync checkout.",
		})
	})

	it("creates checkout through Sync with auth headers and configured callbacks", async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(jsonResponse({ status: "none", entitled: false }))
			.mockResolvedValueOnce(
				jsonResponse({
					checkout_url: "https://pay.example.com/checkout/123",
				}),
			)

		const result = await createCheckoutFromAuthSession({
			session,
			env: {
				CORTEX_SYNC_URL: "https://sync.example.com",
				CORTEX_BILLING_RETURN_URL: "https://site.example.com/billing/cancelled",
				CORTEX_BILLING_COMPLETION_URL: "cortex://sync/checkout-complete",
			},
			fetcher,
		})

		expect(result).toEqual({
			ok: true,
			checkoutUrl: "https://pay.example.com/checkout/123",
		})
		expect(fetcher).toHaveBeenNthCalledWith(
			1,
			"https://sync.example.com/subscription/v1/status",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Accept: "application/json",
					Authorization: "Bearer access-token",
					"X-Device-ID": "device-123",
				}),
			}),
		)
		expect(fetcher).toHaveBeenNthCalledWith(
			2,
			"https://sync.example.com/subscription/v1/checkout",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					return_url: "https://site.example.com/billing/cancelled",
					completion_url: "cortex://sync/checkout-complete",
				}),
				headers: expect.objectContaining({
					Accept: "application/json",
					Authorization: "Bearer access-token",
					"Content-Type": "application/json",
					"X-Device-ID": "device-123",
				}),
			}),
		)
	})

	it("redirects active subscribers to account without creating checkout", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			jsonResponse({
				status: "active",
				entitled: true,
				current_period_end: "2026-07-01T00:00:00Z",
			}),
		)

		const result = await createCheckoutFromAuthSession({
			session,
			env: { CORTEX_SYNC_URL: "https://sync.example.com" },
			fetcher,
		})

		expect(result).toMatchObject({
			ok: true,
			code: "subscription_active",
			redirectTo: "/account",
		})
		expect(fetcher).toHaveBeenCalledTimes(1)
		expect(fetcher.mock.calls[0]?.[0]).toBe("https://sync.example.com/subscription/v1/status")
	})

	it("refreshes an expired access token and retries checkout once", async () => {
		const onSessionRefreshed = vi.fn()
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(jsonResponse({ error: "expired" }, 401))
			.mockResolvedValueOnce(
				jsonResponse({
					access_token: "fresh-access-token",
					refresh_token: "fresh-refresh-token",
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					status: "none",
					entitled: false,
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					checkout_url: "https://pay.example.com/checkout/123",
				}),
			)

		const result = await createCheckoutFromAuthSession({
			session,
			env: { CORTEX_SYNC_URL: "https://sync.example.com" },
			fetcher,
			onSessionRefreshed,
		})

		expect(result.ok).toBe(true)
		expect(fetcher).toHaveBeenCalledTimes(4)
		expect(fetcher.mock.calls[1]?.[0]).toBe("https://sync.example.com/auth/v1/token/refresh")
		expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
			refresh_token: "refresh-token",
		})
		expect(fetcher.mock.calls[2]?.[1]?.headers).toMatchObject({
			Authorization: "Bearer fresh-access-token",
			"X-Device-ID": "device-123",
		})
		expect(onSessionRefreshed).toHaveBeenCalledWith({
			...session,
			accessToken: "fresh-access-token",
			refreshToken: "fresh-refresh-token",
		})
	})

	it("returns an unavailable state for failed checkout responses", async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(jsonResponse({ status: "none", entitled: false }))
			.mockResolvedValueOnce(jsonResponse({ error: "subscription unavailable" }, 503))

		const result = await createCheckoutFromAuthSession({ session, fetcher })

		expect(result).toEqual({
			ok: false,
			code: "checkout_unavailable",
			message: "subscription unavailable",
		})
	})

	it("normalizes subscription status payloads defensively", () => {
		expect(
			normalizeSubscriptionStatus({
				status: "ACTIVE",
				entitled: true,
				current_period_start: "2026-06-01T00:00:00Z",
				current_period_end: "2026-07-01T00:00:00Z",
				entitlement_expires_at: "2026-07-03T00:00:00Z",
				billing_cycle: "MONTHLY",
				plan_product_id: "prod_123",
			}),
		).toEqual({
			status: "active",
			entitled: true,
			currentPeriodStart: "2026-06-01T00:00:00Z",
			currentPeriodEnd: "2026-07-01T00:00:00Z",
			entitlementExpiresAt: "2026-07-03T00:00:00Z",
			billingCycle: "MONTHLY",
			planProductId: "prod_123",
		})
	})
})
