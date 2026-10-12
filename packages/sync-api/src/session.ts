import { hashBytes } from "@cortex/platform/hash"
import { ApiClient, type FetchLike, normalizeServerUrl, type TokenProvider } from "./client"
import { requestRefresh } from "./endpoints"
import { SyncError } from "./errors"
import type { SecretStore } from "./secrets"

const ACCESS_TOKEN = "access_token"
const REFRESH_TOKEN = "refresh_token"
const USER_ID = "user_id"
const USER_EMAIL = "user_email"
const USER_DISPLAY_NAME = "user_display_name"
const SESSION_KEYS = [ACCESS_TOKEN, REFRESH_TOKEN, USER_ID, USER_EMAIL, USER_DISPLAY_NAME]
const REFRESH_MARGIN_SECONDS = 60

export interface StoredUser {
	userId: string | null
	email: string | null
	displayName: string | null
}

export interface AuthSessionOptions {
	onSessionExpired?: (serverUrl: string) => void
	fetch?: FetchLike
}

export function scopedKey(serverUrl: string, key: string): string {
	return `sync:${hashBytes(normalizeServerUrl(serverUrl))}:${key}`
}

function tokenExpiresSoon(token: string): boolean {
	const payload = token.split(".")[1]
	if (!payload) return false
	try {
		const base64 = payload.replaceAll("-", "+").replaceAll("_", "/")
		const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
		const { exp } = JSON.parse(atob(padded)) as { exp?: unknown }
		return typeof exp === "number" && exp - Date.now() / 1000 < REFRESH_MARGIN_SECONDS
	} catch {
		return false
	}
}

export class AuthSession implements TokenProvider {
	private readonly refreshes = new Map<string, Promise<string | null>>()

	constructor(
		private readonly secrets: SecretStore,
		private readonly options: AuthSessionOptions = {},
	) {}

	async load(serverUrl: string): Promise<void> {
		await this.secrets.preload?.(SESSION_KEYS.map((key) => scopedKey(serverUrl, key)))
	}

	storeTokens(serverUrl: string, accessToken: string, refreshToken: string): void {
		this.secrets.set(scopedKey(serverUrl, ACCESS_TOKEN), accessToken)
		this.secrets.set(scopedKey(serverUrl, REFRESH_TOKEN), refreshToken)
	}

	storeUser(serverUrl: string, user: StoredUser): void {
		if (user.userId) this.secrets.set(scopedKey(serverUrl, USER_ID), user.userId)
		if (user.email) this.secrets.set(scopedKey(serverUrl, USER_EMAIL), user.email)
		if (user.displayName) {
			this.secrets.set(scopedKey(serverUrl, USER_DISPLAY_NAME), user.displayName)
		}
	}

	getUser(serverUrl: string): StoredUser {
		return {
			userId: this.secrets.get(scopedKey(serverUrl, USER_ID)),
			email: this.secrets.get(scopedKey(serverUrl, USER_EMAIL)),
			displayName: this.secrets.get(scopedKey(serverUrl, USER_DISPLAY_NAME)),
		}
	}

	hasTokens(serverUrl: string): boolean {
		return (
			this.secrets.get(scopedKey(serverUrl, ACCESS_TOKEN)) !== null &&
			this.secrets.get(scopedKey(serverUrl, REFRESH_TOKEN)) !== null
		)
	}

	clear(serverUrl: string): void {
		for (const key of SESSION_KEYS) this.secrets.delete(scopedKey(serverUrl, key))
	}

	async getAccessToken(serverUrl: string): Promise<string | null> {
		await this.load(serverUrl)
		const token = this.secrets.get(scopedKey(serverUrl, ACCESS_TOKEN))
		if (!token || !tokenExpiresSoon(token)) return token
		return (await this.refreshAccessToken(serverUrl).catch(() => null)) ?? token
	}

	refreshAccessToken(serverUrl: string): Promise<string | null> {
		const key = normalizeServerUrl(serverUrl)
		const inFlight = this.refreshes.get(key)
		if (inFlight) return inFlight
		const refresh = this.refresh(key).finally(() => this.refreshes.delete(key))
		this.refreshes.set(key, refresh)
		return refresh
	}

	private async refresh(serverUrl: string): Promise<string | null> {
		await this.load(serverUrl)
		const refreshToken = this.secrets.get(scopedKey(serverUrl, REFRESH_TOKEN))
		if (!refreshToken) return null
		try {
			const tokens = await requestRefresh(
				new ApiClient(serverUrl, { fetch: this.options.fetch }),
				refreshToken,
			)
			if (tokens.accessToken) {
				this.secrets.set(scopedKey(serverUrl, ACCESS_TOKEN), tokens.accessToken)
			}
			if (tokens.refreshToken) {
				this.secrets.set(scopedKey(serverUrl, REFRESH_TOKEN), tokens.refreshToken)
			}
			return tokens.accessToken
		} catch (error) {
			if (error instanceof SyncError && (error.kind === "auth" || error.kind === "forbidden")) {
				this.clear(serverUrl)
				this.options.onSessionExpired?.(serverUrl)
				return null
			}
			throw error
		}
	}
}
