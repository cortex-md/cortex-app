import { describe, expect, it, vi } from "vitest"
import {
	getAccountOverviewFromAuthSession,
	normalizeAccountDevices,
	normalizeAccountVaults,
} from "./account"
import type { AuthSession } from "./auth"

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

function accountFetcher(overrides: Record<string, Response | (() => Response)> = {}) {
	return vi.fn<typeof fetch>(async (input) => {
		const url = String(input)
		const override = Object.entries(overrides).find(([path]) => url.endsWith(path))?.[1]

		if (override) return typeof override === "function" ? override() : override
		if (url.endsWith("/subscription/v1/status")) {
			return jsonResponse({
				status: "active",
				entitled: true,
				current_period_end: "2026-07-01T00:00:00Z",
				billing_cycle: "MONTHLY",
			})
		}
		if (url.endsWith("/devices/v1/")) {
			return jsonResponse([
				{
					id: "device-123",
					device_name: "Cortex Web",
					device_type: "web",
					last_seen_at: "2026-06-22T18:00:00Z",
					created_at: "2026-06-01T10:00:00Z",
					revoked: false,
					is_current: true,
				},
			])
		}
		if (url.endsWith("/vaults/v1/")) {
			return jsonResponse([
				{
					id: "vault-123",
					name: "Writing",
					description: "Personal notes",
					owner_id: "user-123",
					role: "owner",
					member_count: 2,
					updated_at: "2026-06-21T12:00:00Z",
				},
			])
		}

		return jsonResponse({ error: "not found" }, 404)
	})
}

describe("getAccountOverviewFromAuthSession", () => {
	it("redirects missing sessions to account login", async () => {
		await expect(getAccountOverviewFromAuthSession({ session: null })).resolves.toEqual({
			authenticated: false,
			redirectTo: "/login?redirect=/account",
		})
	})

	it("loads account overview without exposing private identifiers", async () => {
		const fetcher = accountFetcher()

		const result = await getAccountOverviewFromAuthSession({
			session,
			env: { CORTEX_SYNC_URL: "https://sync.example.com" },
			fetcher,
		})

		expect(result).toEqual({
			authenticated: true,
			session: {
				email: "writer@example.com",
			},
			subscription: {
				available: true,
				status: {
					status: "active",
					entitled: true,
					currentPeriodStart: null,
					currentPeriodEnd: "2026-07-01T00:00:00Z",
					entitlementExpiresAt: null,
					billingCycle: "MONTHLY",
					planProductId: null,
				},
			},
			devices: {
				available: true,
				devices: [
					{
						name: "Cortex Web",
						type: "web",
						isCurrent: true,
						isRevoked: false,
						lastSeenAt: "2026-06-22T18:00:00Z",
						createdAt: "2026-06-01T10:00:00Z",
					},
				],
			},
			vaults: {
				available: true,
				vaults: [
					{
						name: "Writing",
						description: "Personal notes",
						role: "owner",
						memberCount: 2,
						updatedAt: "2026-06-21T12:00:00Z",
					},
				],
			},
		})
		expect(JSON.stringify(result)).not.toContain("device-123")
		expect(JSON.stringify(result)).not.toContain("user-123")
		expect(JSON.stringify(result)).not.toContain("vault-123")
		expect(fetcher).toHaveBeenCalledWith(
			"https://sync.example.com/subscription/v1/status",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Authorization: "Bearer access-token",
					"X-Device-ID": "device-123",
				}),
			}),
		)
	})

	it("refreshes a missing access token before loading the account overview", async () => {
		const onSessionRefreshed = vi.fn()
		const fetcher = accountFetcher({
			"/auth/v1/token/refresh": () =>
				jsonResponse({
					access_token: "fresh-access-token",
					refresh_token: "fresh-refresh-token",
				}),
			"/subscription/v1/status": () => jsonResponse({ status: "none", entitled: false }),
			"/devices/v1/": () => jsonResponse([]),
			"/vaults/v1/": () => jsonResponse([]),
		})

		const result = await getAccountOverviewFromAuthSession({
			session: { ...session, accessToken: "" },
			env: { CORTEX_SYNC_URL: "https://sync.example.com" },
			fetcher,
			onSessionRefreshed,
		})

		expect(result).toMatchObject({ authenticated: true })
		expect(fetcher.mock.calls[0]?.[0]).toBe("https://sync.example.com/auth/v1/token/refresh")
		const statusCall = fetcher.mock.calls.find(([url]) =>
			String(url).endsWith("/subscription/v1/status"),
		)
		expect(statusCall?.[1]?.headers).toMatchObject({
			Authorization: "Bearer fresh-access-token",
			"X-Device-ID": "device-123",
		})
		expect(onSessionRefreshed).toHaveBeenCalledWith({
			...session,
			accessToken: "fresh-access-token",
			refreshToken: "fresh-refresh-token",
		})
	})

	it("keeps available account data visible when devices or vaults are temporarily unavailable", async () => {
		const fetcher = accountFetcher({
			"/devices/v1/": () => jsonResponse({ error: "temporarily unavailable" }, 503),
		})

		const result = await getAccountOverviewFromAuthSession({ session, fetcher })

		expect(result).toMatchObject({
			authenticated: true,
			session: { email: "writer@example.com" },
			subscription: { available: true },
			devices: {
				available: false,
				message: "Devices are temporarily unavailable.",
			},
			vaults: { available: true },
		})
	})

	it("normalizes device and vault payloads into public account summaries", () => {
		expect(
			normalizeAccountDevices({
				devices: [
					{
						id: "device-123",
						device_name: "MacBook Pro",
						device_type: "desktop",
						is_current: true,
						revoked: true,
						last_seen_at: "2026-06-23T12:00:00Z",
						created_at: "2026-06-20T12:00:00Z",
					},
				],
			}),
		).toEqual([
			{
				name: "MacBook Pro",
				type: "desktop",
				isCurrent: true,
				isRevoked: true,
				lastSeenAt: "2026-06-23T12:00:00Z",
				createdAt: "2026-06-20T12:00:00Z",
			},
		])
		expect(
			normalizeAccountVaults([
				{
					id: "vault-123",
					name: "Research",
					description: "",
					owner_id: "user-123",
					role: "admin",
					member_count: 4,
					updated_at: "2026-06-22T12:00:00Z",
				},
			]),
		).toEqual([
			{
				name: "Research",
				description: null,
				role: "admin",
				memberCount: 4,
				updatedAt: "2026-06-22T12:00:00Z",
			},
		])
	})
})
