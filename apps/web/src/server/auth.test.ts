import { describe, expect, it, vi } from "vitest"
import {
	getSessionFromAuthSession,
	loginWithSync,
	sanitizeRedirectPath,
	sessionCookieOptions,
	signupWithSync,
	toAuthActionResult,
} from "./auth"

function jsonResponse(payload: unknown, status = 200) {
	return new Response(JSON.stringify(payload), {
		headers: { "Content-Type": "application/json" },
		status,
	})
}

describe("auth Sync helpers", () => {
	it("logs in with a stable web device payload", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			jsonResponse({
				access_token: "access-token",
				refresh_token: "refresh-token",
				user_id: "user-123",
				email: "writer@example.com",
			}),
		)

		const result = await loginWithSync(
			{
				email: "writer@example.com",
				password: "correct-password",
				redirectTo: "/billing",
			},
			{
				currentDeviceId: "device-123",
				env: { CORTEX_SYNC_URL: "https://sync.example.com" },
				fetcher,
			},
		)

		expect(result).toEqual({
			ok: true,
			redirectTo: "/billing",
			session: {
				accessToken: "access-token",
				deviceId: "device-123",
				email: "writer@example.com",
				refreshToken: "refresh-token",
				userId: "user-123",
			},
		})
		expect(fetcher).toHaveBeenCalledWith(
			"https://sync.example.com/auth/v1/login",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					email: "writer@example.com",
					password: "correct-password",
					device_id: "device-123",
					device_name: "Cortex Web",
					device_type: "web",
				}),
			}),
		)
		expect(toAuthActionResult(result)).toEqual({
			ok: true,
			redirectTo: "/billing",
			session: {
				deviceId: "device-123",
				email: "writer@example.com",
				userId: "user-123",
			},
		})
	})

	it("registers, then signs in automatically", async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				jsonResponse({ user_id: "user-123", email: "writer@example.com" }, 201),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					access_token: "access-token",
					refresh_token: "refresh-token",
					user_id: "user-123",
					email: "writer@example.com",
				}),
			)

		const result = await signupWithSync(
			{
				displayName: "Writer",
				email: "writer@example.com",
				password: "correct-password",
				redirectTo: "/billing",
			},
			{
				currentDeviceId: "device-123",
				env: { CORTEX_SYNC_URL: "https://sync.example.com" },
				fetcher,
			},
		)

		expect(result.ok).toBe(true)
		expect(fetcher).toHaveBeenCalledTimes(2)
		expect(fetcher.mock.calls[0]?.[0]).toBe("https://sync.example.com/auth/v1/register")
		expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
			email: "writer@example.com",
			password: "correct-password",
			display_name: "Writer",
		})
		expect(fetcher.mock.calls[1]?.[0]).toBe("https://sync.example.com/auth/v1/login")
	})

	it("maps known Sync auth errors into clear UI messages", async () => {
		const existingUser = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse({ code: "user_exists", error: "user already exists" }, 409))
		const closedRegistration = vi
			.fn<typeof fetch>()
			.mockResolvedValue(
				jsonResponse({ code: "registration_closed", error: "registration closed" }, 403),
			)
		const invalidCredentials = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse({ error: "invalid credentials" }, 401))

		await expect(
			signupWithSync(
				{
					displayName: "Writer",
					email: "writer@example.com",
					password: "correct-password",
				},
				{ fetcher: existingUser },
			),
		).resolves.toEqual({ ok: false, message: "An account already exists for that email." })
		await expect(
			signupWithSync(
				{
					displayName: "Writer",
					email: "writer@example.com",
					password: "correct-password",
				},
				{ fetcher: closedRegistration },
			),
		).resolves.toEqual({ ok: false, message: "Registration is currently closed." })
		await expect(
			loginWithSync(
				{
					email: "writer@example.com",
					password: "wrong-password",
				},
				{ fetcher: invalidCredentials, randomUUID: () => "device-123" },
			),
		).resolves.toEqual({ ok: false, message: "Email or password is incorrect." })
	})

	it("turns network failure into a reachable configuration message", async () => {
		const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network failed"))

		await expect(
			loginWithSync(
				{
					email: "writer@example.com",
					password: "correct-password",
				},
				{ fetcher, randomUUID: () => "device-123" },
			),
		).resolves.toEqual({
			ok: false,
			message: "Cortex Sync is not reachable. Check CORTEX_SYNC_URL and try again.",
		})
	})

	it("uses HttpOnly browser cookies for session material", () => {
		expect(sessionCookieOptions.httpOnly).toBe(true)
		expect(sessionCookieOptions.sameSite).toBe("lax")
		expect(sessionCookieOptions.path).toBe("/")
	})

	it("refreshes a persisted session when the access token is missing", async () => {
		const onSessionRefreshed = vi.fn()
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			jsonResponse({
				access_token: "fresh-access-token",
				refresh_token: "fresh-refresh-token",
			}),
		)

		await expect(
			getSessionFromAuthSession({
				session: {
					accessToken: "",
					deviceId: "device-123",
					email: "writer@example.com",
					refreshToken: "refresh-token",
					userId: "user-123",
				},
				env: { CORTEX_SYNC_URL: "https://sync.example.com" },
				fetcher,
				onSessionRefreshed,
			}),
		).resolves.toEqual({
			authenticated: true,
			session: {
				deviceId: "device-123",
				email: "writer@example.com",
				userId: "user-123",
			},
		})
		expect(fetcher).toHaveBeenCalledWith(
			"https://sync.example.com/auth/v1/token/refresh",
			expect.objectContaining({
				method: "POST",
			}),
		)
		expect(onSessionRefreshed).toHaveBeenCalledWith({
			accessToken: "fresh-access-token",
			deviceId: "device-123",
			email: "writer@example.com",
			refreshToken: "fresh-refresh-token",
			userId: "user-123",
		})
	})

	it("clears an invalid persisted session when refresh fails", async () => {
		const onSessionCleared = vi.fn()
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse({ code: "token_revoked", error: "revoked" }, 401))

		await expect(
			getSessionFromAuthSession({
				session: {
					accessToken: "",
					deviceId: "device-123",
					email: "writer@example.com",
					refreshToken: "refresh-token",
					userId: "user-123",
				},
				fetcher,
				onSessionCleared,
			}),
		).resolves.toEqual({ authenticated: false })
		expect(onSessionCleared).toHaveBeenCalled()
	})

	it("accepts internal redirects and blocks external redirects", () => {
		expect(sanitizeRedirectPath("/billing?next=checkout")).toBe("/billing?next=checkout")
		expect(sanitizeRedirectPath("https://evil.example/billing")).toBe("/account")
		expect(sanitizeRedirectPath("//evil.example/billing")).toBe("/account")
		expect(sanitizeRedirectPath("billing")).toBe("/account")
	})
})
