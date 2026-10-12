import {
	requestLogin,
	requestLogout,
	requestPrelogin,
	requestRegister,
	SyncError,
} from "@cortex/sync-api"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
	createSyncClient,
	resolveActiveSession,
	type SessionDependencies,
	type SyncDependencies,
} from "./sync/api"

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
	kdfSalt: z.string().min(1),
	publicKey: z.string().min(1),
	encryptedPrivateKey: z.string().min(1),
	redirectTo: z.string().optional(),
})

const preloginSchema = z.object({
	email: z.email("Enter a valid email address"),
})

const logoutSchema = z.object({
	allDevices: z.boolean().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type PreloginInput = z.infer<typeof preloginSchema>

export type PreloginResult =
	| { ok: true; kdfVersion: number; kdfSalt: string | null }
	| { ok: false; message: string }

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

interface AuthDependencies extends SyncDependencies {
	currentDeviceId?: string
	randomUUID?: () => string
}

function authErrorMessage(error: unknown) {
	if (error instanceof SyncError) {
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
				return error.detail ?? "Cortex Sync is temporarily unavailable."
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
		const response = await requestLogin(
			createSyncClient(dependencies),
			input.email,
			input.password,
			{
				deviceId,
				deviceName: "Cortex Web",
				deviceType: "web",
			},
		)
		const session: AuthSession = {
			accessToken: response.accessToken,
			deviceId,
			email: response.email,
			refreshToken: response.refreshToken,
			userId: response.userId,
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
		await requestRegister(
			createSyncClient(dependencies),
			input.email,
			input.password,
			input.displayName,
			{
				kdfSalt: input.kdfSalt,
				publicKey: input.publicKey,
				encryptedPrivateKey: input.encryptedPrivateKey,
				recoveryWrappedPrivateKey: null,
			},
		)
	} catch (error) {
		return { ok: false, message: authErrorMessage(error) }
	}

	return loginWithSync(input, dependencies)
}

export async function preloginWithSync(
	input: PreloginInput,
	dependencies: SyncDependencies = {},
): Promise<PreloginResult> {
	try {
		const response = await requestPrelogin(createSyncClient(dependencies), input.email)
		return { ok: true, kdfVersion: response.kdfVersion, kdfSalt: response.kdfSalt }
	} catch (error) {
		if (error instanceof SyncError && error.status === 404) {
			return { ok: true, kdfVersion: 0, kdfSalt: null }
		}
		return { ok: false, message: authErrorMessage(error) }
	}
}

export function toAuthActionResult(result: InternalAuthResult): AuthActionResult {
	if (!result.ok) return result

	return {
		ok: true,
		redirectTo: result.redirectTo,
		session: toPublicSession(result.session),
	}
}

export async function getSessionFromAuthSession(
	dependencies: SessionDependencies = {},
): Promise<AuthSessionResult> {
	const session = await resolveActiveSession(dependencies)

	if (!session) return { authenticated: false }

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

export const prelogin = createServerFn({ method: "POST" })
	.validator(preloginSchema)
	.handler(async ({ data }) => preloginWithSync(data))

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
				await requestLogout(
					createSyncClient({}, session.deviceId, {
						getAccessToken: async () => session.accessToken,
						refreshAccessToken: async () => null,
					}),
					data.allDevices ?? false,
				)
			} catch {
				// Local logout should still clear the browser session if Sync is unavailable.
			}
		}

		clearAuthSessionCookies()
		return { ok: true as const }
	})
