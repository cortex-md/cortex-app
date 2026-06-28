import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { SyncApiError, syncRequest } from "./sync/client"
import type { SyncRuntimeEnv } from "./sync/config"

export const authCookieNames = {
	accessToken: "cortex_access_token",
	deviceId: "cortex_device_id",
	email: "cortex_user_email",
	refreshToken: "cortex_refresh_token",
	userId: "cortex_user_id",
} as const

export const sessionCookieOptions = {
	httpOnly: true,
	path: "/",
	sameSite: "lax" as const,
	secure: process.env.NODE_ENV === "production",
}

const loginSchema = z.object({
	email: z.email("Enter a valid email address"),
	password: z.string().min(1, "Enter your password"),
	redirectTo: z.string().optional(),
})

const signupSchema = z.object({
	displayName: z.string().trim().min(1, "Enter your name").max(120, "Name is too long"),
	email: z.email("Enter a valid email address"),
	password: z.string().min(8, "Use at least 8 characters"),
	redirectTo: z.string().optional(),
})

const logoutSchema = z.object({
	allDevices: z.boolean().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>

export interface AuthSession {
	accessToken: string
	deviceId: string
	email: string
	refreshToken: string
	userId: string
}

export type AuthActionResult =
	| { ok: true; redirectTo: string; session: { deviceId: string; email: string; userId: string } }
	| { ok: false; message: string }

type InternalAuthResult =
	| { ok: true; redirectTo: string; session: AuthSession }
	| { ok: false; message: string }

export type AuthSessionResult =
	| { authenticated: false }
	| { authenticated: true; session: { deviceId: string; email: string; userId: string } }

interface SyncLoginResponse {
	access_token: string
	email: string
	refresh_token: string
	user_id: string
}

interface SyncRefreshResponse {
	access_token: string
	refresh_token: string
}

interface AuthDependencies {
	currentDeviceId?: string
	env?: SyncRuntimeEnv
	fetcher?: typeof fetch
	randomUUID?: () => string
}

interface SessionDependencies {
	env?: SyncRuntimeEnv
	fetcher?: typeof fetch
	onSessionCleared?: () => void
	onSessionRefreshed?: (session: AuthSession) => void
	session?: AuthSession | null
}

function authErrorMessage(error: unknown) {
	if (error instanceof SyncApiError) {
		switch (error.code) {
			case "user_exists":
				return "An account already exists for that email."
			case "registration_closed":
				return "Registration is currently closed."
			case "device_revoked":
				return "This device was revoked. Sign in from another device or contact support."
			case "token_expired":
			case "token_revoked":
			case "token_reuse":
				return "Your session expired. Sign in again."
			default:
				if (error.status === 401) return "Email or password is incorrect."
				return error.message
		}
	}

	return "Cortex Sync is not reachable. Check CORTEX_SYNC_URL and try again."
}

export function sanitizeRedirectPath(value?: string | null, fallback = "/account") {
	if (!value) return fallback
	if (!value.startsWith("/") || value.startsWith("//")) return fallback

	try {
		const url = new URL(value, "https://cortex.local")
		if (url.origin !== "https://cortex.local") return fallback
		return `${url.pathname}${url.search}${url.hash}`
	} catch {
		return fallback
	}
}

function toPublicSession(session: AuthSession) {
	return {
		deviceId: session.deviceId,
		email: session.email,
		userId: session.userId,
	}
}

export async function loginWithSync(
	input: LoginInput,
	dependencies: AuthDependencies = {},
): Promise<InternalAuthResult> {
	const deviceId =
		dependencies.currentDeviceId || dependencies.randomUUID?.() || crypto.randomUUID()

	try {
		const response = await syncRequest<SyncLoginResponse>("/auth/v1/login", {
			method: "POST",
			body: {
				email: input.email,
				password: input.password,
				device_id: deviceId,
				device_name: "Cortex Web",
				device_type: "web",
			},
			env: dependencies.env,
			fetcher: dependencies.fetcher,
		})
		const session: AuthSession = {
			accessToken: response.access_token,
			deviceId,
			email: response.email,
			refreshToken: response.refresh_token,
			userId: response.user_id,
		}

		return {
			ok: true,
			redirectTo: sanitizeRedirectPath(input.redirectTo),
			session,
		}
	} catch (error) {
		return { ok: false, message: authErrorMessage(error) }
	}
}

export async function signupWithSync(
	input: SignupInput,
	dependencies: AuthDependencies = {},
): Promise<InternalAuthResult> {
	try {
		await syncRequest("/auth/v1/register", {
			method: "POST",
			body: {
				email: input.email,
				password: input.password,
				display_name: input.displayName,
			},
			env: dependencies.env,
			fetcher: dependencies.fetcher,
		})
	} catch (error) {
		return { ok: false, message: authErrorMessage(error) }
	}

	return loginWithSync(input, dependencies)
}

export function toAuthActionResult(result: InternalAuthResult): AuthActionResult {
	if (!result.ok) return result

	return {
		ok: true,
		redirectTo: result.redirectTo,
		session: toPublicSession(result.session),
	}
}

export async function refreshAuthSession(
	session: AuthSession,
	dependencies: Pick<AuthDependencies, "env" | "fetcher"> = {},
) {
	const response = await syncRequest<SyncRefreshResponse>("/auth/v1/token/refresh", {
		method: "POST",
		body: {
			refresh_token: session.refreshToken,
		},
		env: dependencies.env,
		fetcher: dependencies.fetcher,
	})

	return {
		...session,
		accessToken: response.access_token,
		refreshToken: response.refresh_token,
	}
}

export async function getSessionFromAuthSession(
	dependencies: SessionDependencies = {},
): Promise<AuthSessionResult> {
	let session = dependencies.session ?? null

	if (!session) return { authenticated: false }

	if (!session.accessToken) {
		try {
			session = await refreshAuthSession(session, {
				env: dependencies.env,
				fetcher: dependencies.fetcher,
			})
			dependencies.onSessionRefreshed?.(session)
		} catch {
			dependencies.onSessionCleared?.()
			return { authenticated: false }
		}
	}

	return {
		authenticated: true,
		session: toPublicSession(session),
	}
}

export const login = createServerFn({ method: "POST" })
	.validator(loginSchema)
	.handler(async ({ data }) => {
		const { getCurrentDeviceId, setAuthSessionCookies } = await import("./auth-cookies.server")
		const deviceId = getCurrentDeviceId()
		const result = await loginWithSync(data, { currentDeviceId: deviceId })

		if (result.ok) {
			setAuthSessionCookies(result.session)
		}

		return toAuthActionResult(result)
	})

export const signup = createServerFn({ method: "POST" })
	.validator(signupSchema)
	.handler(async ({ data }) => {
		const { getCurrentDeviceId, setAuthSessionCookies } = await import("./auth-cookies.server")
		const deviceId = getCurrentDeviceId()
		const result = await signupWithSync(data, { currentDeviceId: deviceId })

		if (result.ok) {
			setAuthSessionCookies(result.session)
		}

		return toAuthActionResult(result)
	})

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
	const { clearAuthSessionCookies, readAuthSessionFromCookies, setAuthSessionCookies } =
		await import("./auth-cookies.server")

	return getSessionFromAuthSession({
		onSessionCleared: clearAuthSessionCookies,
		onSessionRefreshed: setAuthSessionCookies,
		session: readAuthSessionFromCookies(),
	})
})

export const logout = createServerFn({ method: "POST" })
	.validator(logoutSchema)
	.handler(async ({ data }) => {
		const { clearAuthSessionCookies, readAuthSessionFromCookies } = await import(
			"./auth-cookies.server"
		)
		const session = readAuthSessionFromCookies()

		if (session?.accessToken && session.deviceId) {
			try {
				await syncRequest("/auth/v1/logout", {
					method: "POST",
					body: { all_devices: data.allDevices ?? false },
					accessToken: session.accessToken,
					deviceId: session.deviceId,
				})
			} catch {
				// Local logout should still clear the browser session if Sync is unavailable.
			}
		}

		clearAuthSessionCookies()
		return { ok: true as const }
	})
