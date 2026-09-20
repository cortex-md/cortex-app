import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"
import { emitToRenderer } from "../events"
import { getDeviceId } from "./device"
import * as keychain from "./keychain"

const ACCESS_TOKEN_KEY = "access_token"
const REFRESH_TOKEN_KEY = "refresh_token"
const SERVER_URL_KEY = "server_url"
const USER_ID_KEY = "user_id"
const USER_EMAIL_KEY = "user_email"
const USER_DISPLAY_NAME_KEY = "user_display_name"

let serverUrl = ""
let refreshPromise: Promise<void> | null = null

export function normalizeServerUrl(url: string): string {
	return url.trim().replace(/\/+$/, "").toLowerCase()
}

export function scopedKey(serverUrlValue: string, key: string): string {
	const normalized = normalizeServerUrl(serverUrlValue)
	const hash = bytesToHex(blake3(new TextEncoder().encode(normalized)))
	return `sync:${hash}:${key}`
}

export function setServerUrl(url: string): void {
	serverUrl = normalizeServerUrl(url)
}

export function getServerUrl(): string {
	return serverUrl
}

export function loadServerUrl(): void {
	const stored = keychain.get(SERVER_URL_KEY)
	if (stored) serverUrl = stored
}

function shouldRefresh(token: string): boolean {
	const parts = token.split(".")
	if (parts.length !== 3) return false
	try {
		const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as {
			exp?: number
		}
		if (typeof payload.exp !== "number") return false
		const now = Math.floor(Date.now() / 1000)
		return payload.exp - now < 60
	} catch {
		return false
	}
}

export function storeTokensForServer(
	serverUrlValue: string,
	accessToken: string,
	refreshToken: string,
): void {
	const normalized = normalizeServerUrl(serverUrlValue)
	keychain.set(scopedKey(normalized, ACCESS_TOKEN_KEY), accessToken)
	keychain.set(scopedKey(normalized, REFRESH_TOKEN_KEY), refreshToken)
}

export function clearTokensForServer(serverUrlValue: string): void {
	const normalized = normalizeServerUrl(serverUrlValue)
	keychain.delete(scopedKey(normalized, ACCESS_TOKEN_KEY))
	keychain.delete(scopedKey(normalized, REFRESH_TOKEN_KEY))
}

export function storeUserForServer(
	serverUrlValue: string,
	userId: string,
	email: string,
	displayName?: string | null,
): void {
	const normalized = normalizeServerUrl(serverUrlValue)
	keychain.set(scopedKey(normalized, USER_ID_KEY), userId)
	keychain.set(scopedKey(normalized, USER_EMAIL_KEY), email)
	if (displayName) {
		keychain.set(scopedKey(normalized, USER_DISPLAY_NAME_KEY), displayName)
	}
}

export function clearTokensAndUserInfoForServer(serverUrlValue: string): void {
	const normalized = normalizeServerUrl(serverUrlValue)
	clearTokensForServer(normalized)
	keychain.delete(scopedKey(normalized, USER_ID_KEY))
	keychain.delete(scopedKey(normalized, USER_EMAIL_KEY))
	keychain.delete(scopedKey(normalized, USER_DISPLAY_NAME_KEY))
}

function migrateLegacyAuth(serverUrlValue: string): void {
	const normalized = normalizeServerUrl(serverUrlValue)
	if (!normalized) return
	if (keychain.get(scopedKey(normalized, ACCESS_TOKEN_KEY))) return

	const legacyServer = keychain.get(SERVER_URL_KEY) ?? ""
	const legacyMatches =
		!legacyServer.trim() || normalizeServerUrl(legacyServer) === normalized
	if (!legacyMatches) return

	const legacyAccess = keychain.get(ACCESS_TOKEN_KEY)
	const legacyRefresh = keychain.get(REFRESH_TOKEN_KEY)
	if (legacyAccess) keychain.set(scopedKey(normalized, ACCESS_TOKEN_KEY), legacyAccess)
	if (legacyRefresh) keychain.set(scopedKey(normalized, REFRESH_TOKEN_KEY), legacyRefresh)

	const userId = keychain.get(USER_ID_KEY)
	const email = keychain.get(USER_EMAIL_KEY)
	const displayName = keychain.get(USER_DISPLAY_NAME_KEY)
	if (userId) keychain.set(scopedKey(normalized, USER_ID_KEY), userId)
	if (email) keychain.set(scopedKey(normalized, USER_EMAIL_KEY), email)
	if (displayName) keychain.set(scopedKey(normalized, USER_DISPLAY_NAME_KEY), displayName)

	keychain.delete(ACCESS_TOKEN_KEY)
	keychain.delete(REFRESH_TOKEN_KEY)
	keychain.delete(USER_ID_KEY)
	keychain.delete(USER_EMAIL_KEY)
	keychain.delete(USER_DISPLAY_NAME_KEY)
}

export function getAccessTokenForServer(serverUrlValue: string): string | null {
	const normalized = normalizeServerUrl(serverUrlValue)
	migrateLegacyAuth(normalized)
	return keychain.get(scopedKey(normalized, ACCESS_TOKEN_KEY))
}

export function getRefreshTokenForServer(serverUrlValue: string): string | null {
	const normalized = normalizeServerUrl(serverUrlValue)
	migrateLegacyAuth(normalized)
	return keychain.get(scopedKey(normalized, REFRESH_TOKEN_KEY))
}

export function getUserForServer(
	serverUrlValue: string,
): [string | null, string | null, string | null] {
	const normalized = normalizeServerUrl(serverUrlValue)
	migrateLegacyAuth(normalized)
	return [
		keychain.get(scopedKey(normalized, USER_ID_KEY)),
		keychain.get(scopedKey(normalized, USER_EMAIL_KEY)),
		keychain.get(scopedKey(normalized, USER_DISPLAY_NAME_KEY)),
	]
}

export function hasTokensForServer(serverUrlValue: string): boolean {
	const normalized = normalizeServerUrl(serverUrlValue)
	migrateLegacyAuth(normalized)
	return Boolean(
		keychain.get(scopedKey(normalized, ACCESS_TOKEN_KEY)) &&
			keychain.get(scopedKey(normalized, REFRESH_TOKEN_KEY)),
	)
}

async function refreshTokensInternal(): Promise<void> {
	if (refreshPromise) {
		await refreshPromise
		return
	}
	refreshPromise = (async () => {
		const currentServerUrl = getServerUrl()
		migrateLegacyAuth(currentServerUrl)
		const refreshToken = getRefreshTokenForServer(currentServerUrl)
		if (!refreshToken) throw new Error("No refresh token")

		const response = await fetch(`${currentServerUrl}/auth/v1/token/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refresh_token: refreshToken }),
		})

		if (response.status === 401 || response.status === 403) {
			clearTokensAndUserInfoForServer(currentServerUrl)
			emitToRenderer("auth-session-expired")
			throw new Error("Session expired: refresh token revoked or invalid")
		}
		if (!response.ok) {
			throw new Error(`Token refresh failed with HTTP ${response.status}`)
		}

		const body = (await response.json()) as {
			access_token?: string
			refresh_token?: string
		}
		if (body.access_token) {
			keychain.set(scopedKey(currentServerUrl, ACCESS_TOKEN_KEY), body.access_token)
		}
		if (body.refresh_token) {
			keychain.set(scopedKey(currentServerUrl, REFRESH_TOKEN_KEY), body.refresh_token)
		}
	})()

	try {
		await refreshPromise
	} finally {
		refreshPromise = null
	}
}

async function authHeaders(): Promise<Record<string, string>> {
	const headers: Record<string, string> = {
		"X-Device-ID": getDeviceId(),
	}
	const currentServerUrl = getServerUrl()
	migrateLegacyAuth(currentServerUrl)
	let accessToken = getAccessTokenForServer(currentServerUrl)
	if (accessToken && shouldRefresh(accessToken)) {
		try {
			await refreshTokensInternal()
			accessToken = getAccessTokenForServer(currentServerUrl)
		} catch {
			// Keep using existing token if refresh fails.
		}
	}
	if (accessToken) {
		headers.Authorization = `Bearer ${accessToken}`
	}
	return headers
}

async function request(
	method: string,
	path: string,
	init: RequestInit = {},
	retried = false,
): Promise<Response> {
	const url = `${getServerUrl()}${path}`
	const headers = {
		...(init.headers as Record<string, string> | undefined),
		...(await authHeaders()),
	}
	const response = await fetch(url, { ...init, method, headers })
	if (response.status === 401 && !retried) {
		try {
			await refreshTokensInternal()
			return await request(method, path, init, true)
		} catch {
			return response
		}
	}
	return response
}

export async function get(path: string): Promise<Response> {
	return await request("GET", path)
}

export async function postJson(path: string, body: unknown): Promise<Response> {
	return await request("POST", path, {
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	})
}

export async function patchJson(path: string, body: unknown): Promise<Response> {
	return await request("PATCH", path, {
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	})
}

export async function putJson(path: string, body: unknown): Promise<Response> {
	return await request("PUT", path, {
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	})
}

export async function deleteRequest(path: string): Promise<Response> {
	return await request("DELETE", path)
}

export async function parseResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const body = await response.text().catch(() => "")
		throw new Error(`HTTP ${response.status}: ${body}`)
	}
	return (await response.json()) as T
}

export function subscriptionCodeFromText(text: string): "subscription_expired" | "subscription_required" | null {
	const normalized = text.toLowerCase()
	if (normalized.includes("subscription_expired") || normalized.includes("plan has expired")) {
		return "subscription_expired"
	}
	if (
		normalized.includes("subscription_required") ||
		normalized.includes("http 402") ||
		normalized.includes("plan is required")
	) {
		return "subscription_required"
	}
	return null
}
