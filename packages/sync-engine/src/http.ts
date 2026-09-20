import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"

const ACCESS_TOKEN_KEY = "access_token"
const REFRESH_TOKEN_KEY = "refresh_token"
const SERVER_URL_KEY = "server_url"
const USER_ID_KEY = "user_id"
const USER_EMAIL_KEY = "user_email"
const USER_DISPLAY_NAME_KEY = "user_display_name"

export interface KeychainLike {
	get(account: string): string | null
	set(account: string, value: string): void
	delete(account: string): void
}

export interface DeviceLike {
	getDeviceId(): string
}

export interface SyncHttpResponse {
	status: number
	ok: boolean
	headers: Headers
	text(): Promise<string>
	json<T = unknown>(): Promise<T>
	bytes(): Promise<Buffer>
}

export interface SyncHttpClientOptions {
	keychain: KeychainLike
	device: DeviceLike
	onSessionExpired?: () => void
	serverUrl?: string
}

export function subscriptionCodeFromText(
	text: string,
): "subscription_expired" | "subscription_required" | null {
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

export function isSubscriptionAccessError(text: string): boolean {
	return subscriptionCodeFromText(text) !== null
}

export function subscriptionAccessMessage(code: string | null | undefined): string {
	if (code === "subscription_expired") {
		return "Your Cortex Cloud plan has expired. Renew your plan to resume sync."
	}
	return "A Cortex Cloud plan is required to sync with Cortex Cloud."
}

export function normalizeServerUrl(url: string): string {
	return url.trim().replace(/\/+$/, "").toLowerCase()
}

export function scopedKey(serverUrl: string, key: string): string {
	const normalized = normalizeServerUrl(serverUrl)
	const hash = bytesToHex(blake3(new TextEncoder().encode(normalized)))
	return `sync:${hash}:${key}`
}

export async function parseResponse<T>(response: SyncHttpResponse): Promise<T> {
	if (!response.ok) {
		const body = await response.text()
		throw new Error(`HTTP ${response.status}: ${body}`)
	}
	return await response.json<T>()
}

export function storeTokensForServer(
	keychain: KeychainLike,
	serverUrl: string,
	accessToken: string,
	refreshToken: string,
): void {
	const normalized = normalizeServerUrl(serverUrl)
	keychain.set(scopedKey(normalized, ACCESS_TOKEN_KEY), accessToken)
	keychain.set(scopedKey(normalized, REFRESH_TOKEN_KEY), refreshToken)
}

export function clearTokensForServer(keychain: KeychainLike, serverUrl: string): void {
	const normalized = normalizeServerUrl(serverUrl)
	keychain.delete(scopedKey(normalized, ACCESS_TOKEN_KEY))
	keychain.delete(scopedKey(normalized, REFRESH_TOKEN_KEY))
}

export function storeUserForServer(
	keychain: KeychainLike,
	serverUrl: string,
	userId: string,
	email: string,
	displayName?: string | null,
): void {
	const normalized = normalizeServerUrl(serverUrl)
	keychain.set(scopedKey(normalized, USER_ID_KEY), userId)
	keychain.set(scopedKey(normalized, USER_EMAIL_KEY), email)
	if (displayName) {
		keychain.set(scopedKey(normalized, USER_DISPLAY_NAME_KEY), displayName)
	}
}

export function clearTokensAndUserInfoForServer(keychain: KeychainLike, serverUrl: string): void {
	const normalized = normalizeServerUrl(serverUrl)
	clearTokensForServer(keychain, normalized)
	keychain.delete(scopedKey(normalized, USER_ID_KEY))
	keychain.delete(scopedKey(normalized, USER_EMAIL_KEY))
	keychain.delete(scopedKey(normalized, USER_DISPLAY_NAME_KEY))
}

export function migrateLegacyAuth(keychain: KeychainLike, serverUrl: string): void {
	const normalized = normalizeServerUrl(serverUrl)
	if (!normalized) return
	if (keychain.get(scopedKey(normalized, ACCESS_TOKEN_KEY))) return

	const legacyServer = keychain.get(SERVER_URL_KEY) ?? ""
	const legacyMatches =
		legacyServer.trim() === "" || normalizeServerUrl(legacyServer) === normalized
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

export function getAccessTokenForServer(keychain: KeychainLike, serverUrl: string): string | null {
	const normalized = normalizeServerUrl(serverUrl)
	migrateLegacyAuth(keychain, normalized)
	return keychain.get(scopedKey(normalized, ACCESS_TOKEN_KEY))
}

export function getRefreshTokenForServer(keychain: KeychainLike, serverUrl: string): string | null {
	const normalized = normalizeServerUrl(serverUrl)
	migrateLegacyAuth(keychain, normalized)
	return keychain.get(scopedKey(normalized, REFRESH_TOKEN_KEY))
}

export function getUserForServer(
	keychain: KeychainLike,
	serverUrl: string,
): { userId: string | null; email: string | null; displayName: string | null } {
	const normalized = normalizeServerUrl(serverUrl)
	migrateLegacyAuth(keychain, normalized)
	return {
		userId: keychain.get(scopedKey(normalized, USER_ID_KEY)),
		email: keychain.get(scopedKey(normalized, USER_EMAIL_KEY)),
		displayName: keychain.get(scopedKey(normalized, USER_DISPLAY_NAME_KEY)),
	}
}

export function hasTokensForServer(keychain: KeychainLike, serverUrl: string): boolean {
	const normalized = normalizeServerUrl(serverUrl)
	migrateLegacyAuth(keychain, normalized)
	return (
		keychain.get(scopedKey(normalized, ACCESS_TOKEN_KEY)) !== null &&
		keychain.get(scopedKey(normalized, REFRESH_TOKEN_KEY)) !== null
	)
}

function shouldRefresh(token: string): boolean {
	const parts = token.split(".")
	if (parts.length !== 3) return false
	try {
		const payload = Buffer.from(parts[1] ?? "", "base64url").toString("utf8")
		const json = JSON.parse(payload) as { exp?: number }
		if (typeof json.exp !== "number") return false
		const now = Math.floor(Date.now() / 1000)
		return json.exp - now < 60
	} catch {
		return false
	}
}

async function toSyncResponse(response: Response): Promise<SyncHttpResponse> {
	const cloned = response.clone()
	return {
		status: response.status,
		ok: response.ok,
		headers: response.headers,
		text: () => response.text(),
		json: <T>() => response.json() as Promise<T>,
		bytes: async () => Buffer.from(await cloned.arrayBuffer()),
	}
}

export class SyncHttpClient {
	private serverUrl: string
	private refreshLock: Promise<void> | null = null
	private readonly keychain: KeychainLike
	private readonly device: DeviceLike
	private readonly onSessionExpired?: () => void

	constructor(options: SyncHttpClientOptions) {
		this.keychain = options.keychain
		this.device = options.device
		this.onSessionExpired = options.onSessionExpired
		this.serverUrl = options.serverUrl ? normalizeServerUrl(options.serverUrl) : ""
	}

	setServerUrl(url: string): void {
		this.serverUrl = normalizeServerUrl(url)
	}

	getServerUrl(): string {
		return this.serverUrl
	}

	loadServerUrl(): void {
		const url = this.keychain.get(SERVER_URL_KEY)
		if (url) this.serverUrl = normalizeServerUrl(url)
	}

	get keychainHandle(): KeychainLike {
		return this.keychain
	}

	private async authHeaders(): Promise<Record<string, string>> {
		const headers: Record<string, string> = {
			"X-Device-ID": this.device.getDeviceId(),
		}
		if (!this.serverUrl) return headers

		migrateLegacyAuth(this.keychain, this.serverUrl)
		let accessToken = getAccessTokenForServer(this.keychain, this.serverUrl)
		if (accessToken && shouldRefresh(accessToken)) {
			try {
				await this.refreshTokensInternal()
				accessToken = getAccessTokenForServer(this.keychain, this.serverUrl)
			} catch {
				// Keep using the existing token; request path may retry on 401.
			}
		}
		if (accessToken) {
			headers.Authorization = `Bearer ${accessToken}`
		}
		return headers
	}

	private async request(
		method: string,
		path: string,
		init: RequestInit = {},
		retryOnUnauthorized = true,
	): Promise<SyncHttpResponse> {
		const url = `${this.serverUrl}${path}`
		const auth = await this.authHeaders()
		const headers = new Headers(init.headers)
		for (const [key, value] of Object.entries(auth)) {
			headers.set(key, value)
		}
		const response = await fetch(url, { ...init, method, headers })
		if (response.status === 401 && retryOnUnauthorized) {
			try {
				await this.refreshTokensInternal()
				return await this.request(method, path, init, false)
			} catch {
				return await toSyncResponse(response)
			}
		}
		return await toSyncResponse(response)
	}

	async get(path: string): Promise<SyncHttpResponse> {
		return await this.request("GET", path)
	}

	async delete(path: string): Promise<SyncHttpResponse> {
		return await this.request("DELETE", path)
	}

	async postJson(path: string, body: unknown): Promise<SyncHttpResponse> {
		return await this.request("POST", path, {
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
	}

	async putJson(path: string, body: unknown): Promise<SyncHttpResponse> {
		return await this.request("PUT", path, {
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
	}

	async patchJson(path: string, body: unknown): Promise<SyncHttpResponse> {
		return await this.request("PATCH", path, {
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
	}

	async postBytes(
		path: string,
		body: Buffer | Uint8Array,
		headers: Array<[string, string]>,
	): Promise<SyncHttpResponse> {
		const headerInit = new Headers()
		for (const [key, value] of headers) {
			headerInit.set(key, value)
		}
		return await this.request("POST", path, {
			headers: headerInit,
			body: Buffer.from(body),
		})
	}

	private async refreshTokensInternal(): Promise<void> {
		if (this.refreshLock) {
			await this.refreshLock
			return
		}
		this.refreshLock = this.doRefresh()
		try {
			await this.refreshLock
		} finally {
			this.refreshLock = null
		}
	}

	private async doRefresh(): Promise<void> {
		const serverUrl = this.serverUrl
		migrateLegacyAuth(this.keychain, serverUrl)
		const refreshToken = getRefreshTokenForServer(this.keychain, serverUrl)
		if (!refreshToken) throw new Error("No refresh token")

		const response = await fetch(`${serverUrl}/auth/v1/token/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refresh_token: refreshToken }),
		})

		if (response.status === 401 || response.status === 403) {
			clearTokensAndUserInfoForServer(this.keychain, serverUrl)
			this.onSessionExpired?.()
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
			this.keychain.set(scopedKey(serverUrl, ACCESS_TOKEN_KEY), body.access_token)
		}
		if (body.refresh_token) {
			this.keychain.set(scopedKey(serverUrl, REFRESH_TOKEN_KEY), body.refresh_token)
		}
	}
}
