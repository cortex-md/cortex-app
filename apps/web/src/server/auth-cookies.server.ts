import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server"
import { type AuthSession, authCookieNames, sessionCookieOptions } from "./auth"

const sessionCookieMaxAge = 60 * 60 * 24 * 90
const accessCookieMaxAge = 60 * 15

export function getCurrentDeviceId() {
	return getCookie(authCookieNames.deviceId)
}

export function readAuthSessionFromCookies(): AuthSession | null {
	const accessToken = getCookie(authCookieNames.accessToken)
	const deviceId = getCookie(authCookieNames.deviceId)
	const email = getCookie(authCookieNames.email)
	const refreshToken = getCookie(authCookieNames.refreshToken)
	const userId = getCookie(authCookieNames.userId)

	if (!deviceId || !email || !refreshToken || !userId) return null

	return {
		accessToken: accessToken ?? "",
		deviceId,
		email,
		refreshToken,
		userId,
	}
}

export function setAuthSessionCookies(session: AuthSession) {
	setCookie(authCookieNames.accessToken, session.accessToken, {
		...sessionCookieOptions,
		maxAge: accessCookieMaxAge,
	})
	setCookie(authCookieNames.refreshToken, session.refreshToken, {
		...sessionCookieOptions,
		maxAge: sessionCookieMaxAge,
	})
	setCookie(authCookieNames.deviceId, session.deviceId, {
		...sessionCookieOptions,
		maxAge: sessionCookieMaxAge,
	})
	setCookie(authCookieNames.userId, session.userId, {
		...sessionCookieOptions,
		maxAge: sessionCookieMaxAge,
	})
	setCookie(authCookieNames.email, session.email, {
		...sessionCookieOptions,
		maxAge: sessionCookieMaxAge,
	})
}

export function clearAuthSessionCookies() {
	for (const cookieName of Object.values(authCookieNames)) {
		deleteCookie(cookieName, { path: "/" })
	}
}
