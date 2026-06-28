import { createServerFn } from "@tanstack/react-start"
import { type AuthSession, refreshAuthSession } from "./auth"
import {
	normalizeSubscriptionStatus,
	type SubscriptionStatus,
	type SubscriptionStatusResponse,
} from "./billing"
import { SyncApiError, syncRequest } from "./sync/client"
import type { SyncRuntimeEnv } from "./sync/config"

export type { SubscriptionStatus } from "./billing"

export interface AccountPublicSession {
	email: string
}

export interface AccountDeviceSummary {
	createdAt: string | null
	isCurrent: boolean
	isRevoked: boolean
	lastSeenAt: string | null
	name: string
	type: string
}

export type AccountVaultRole = "admin" | "editor" | "owner" | "unknown" | "viewer"

export interface AccountVaultSummary {
	description: string | null
	memberCount: number | null
	name: string
	role: AccountVaultRole
	updatedAt: string | null
}

export type AccountSubscriptionResult =
	| { available: true; status: SubscriptionStatus }
	| { available: false; message: string }

export type AccountDevicesResult =
	| { available: true; devices: AccountDeviceSummary[] }
	| { available: false; message: string }

export type AccountVaultsResult =
	| { available: true; vaults: AccountVaultSummary[] }
	| { available: false; message: string }

export type AccountOverviewResult =
	| { authenticated: false; redirectTo: string }
	| {
			authenticated: true
			devices: AccountDevicesResult
			session: AccountPublicSession
			subscription: AccountSubscriptionResult
			vaults: AccountVaultsResult
	  }

interface AccountDependencies {
	env?: SyncRuntimeEnv
	fetcher?: typeof fetch
	onSessionCleared?: () => void
	onSessionRefreshed?: (session: AuthSession) => void
	session?: AuthSession | null
}

function isAuthFailure(error: unknown) {
	if (!(error instanceof SyncApiError)) return false
	return (
		error.status === 401 ||
		error.code === "token_expired" ||
		error.code === "token_revoked" ||
		error.code === "token_reuse"
	)
}

function toPublicSession(session: AuthSession): AccountPublicSession {
	return {
		email: session.email,
	}
}

function normalizeString(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeNumber(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
}

function normalizeItemsPayload(payload: unknown, key: "devices" | "vaults") {
	if (Array.isArray(payload)) return payload
	if (
		payload &&
		typeof payload === "object" &&
		Array.isArray((payload as Record<string, unknown>)[key])
	) {
		return (payload as Record<string, unknown>)[key] as unknown[]
	}
	return []
}

function normalizeVaultRole(value: unknown): AccountVaultRole {
	const role = normalizeString(value)?.toLowerCase()
	if (role === "admin" || role === "editor" || role === "owner" || role === "viewer") {
		return role
	}
	return "unknown"
}

export function normalizeAccountDevices(payload: unknown): AccountDeviceSummary[] {
	return normalizeItemsPayload(payload, "devices").map((item) => {
		const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
		const type = normalizeString(record.device_type) ?? "unknown"

		return {
			name: normalizeString(record.device_name) ?? "Unnamed device",
			type,
			isCurrent: record.is_current === true,
			isRevoked: record.revoked === true,
			lastSeenAt: normalizeString(record.last_seen_at),
			createdAt: normalizeString(record.created_at),
		}
	})
}

export function normalizeAccountVaults(payload: unknown): AccountVaultSummary[] {
	return normalizeItemsPayload(payload, "vaults").map((item) => {
		const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {}

		return {
			name: normalizeString(record.name) ?? "Untitled vault",
			description: normalizeString(record.description),
			role: normalizeVaultRole(record.role),
			memberCount: normalizeNumber(record.member_count),
			updatedAt: normalizeString(record.updated_at),
		}
	})
}

async function refreshSessionOrUnauthenticated(
	session: AuthSession,
	dependencies: AccountDependencies,
) {
	try {
		const refreshedSession = await refreshAuthSession(session, {
			env: dependencies.env,
			fetcher: dependencies.fetcher,
		})
		dependencies.onSessionRefreshed?.(refreshedSession)
		return refreshedSession
	} catch {
		dependencies.onSessionCleared?.()
		return null
	}
}

async function readSubscriptionStatus(session: AuthSession, dependencies: AccountDependencies) {
	const payload = await syncRequest<SubscriptionStatusResponse>("/subscription/v1/status", {
		accessToken: session.accessToken,
		deviceId: session.deviceId,
		env: dependencies.env,
		fetcher: dependencies.fetcher,
	})

	return normalizeSubscriptionStatus(payload)
}

async function readDevices(session: AuthSession, dependencies: AccountDependencies) {
	const payload = await syncRequest<unknown>("/devices/v1/", {
		accessToken: session.accessToken,
		deviceId: session.deviceId,
		env: dependencies.env,
		fetcher: dependencies.fetcher,
	})

	return normalizeAccountDevices(payload)
}

async function readVaults(session: AuthSession, dependencies: AccountDependencies) {
	const payload = await syncRequest<unknown>("/vaults/v1/", {
		accessToken: session.accessToken,
		deviceId: session.deviceId,
		env: dependencies.env,
		fetcher: dependencies.fetcher,
	})

	return normalizeAccountVaults(payload)
}

type CapturedResult<T> = { ok: true; value: T } | { error: unknown; ok: false }

async function capture<T>(promise: Promise<T>): Promise<CapturedResult<T>> {
	try {
		return { ok: true, value: await promise }
	} catch (error) {
		return { error, ok: false }
	}
}

function getCapturedAuthFailure(results: Array<CapturedResult<unknown>>) {
	const failedResult = results.find((result) => !result.ok && isAuthFailure(result.error))
	return failedResult && !failedResult.ok ? failedResult.error : null
}

async function readAccountData(session: AuthSession, dependencies: AccountDependencies) {
	const [subscription, devices, vaults] = await Promise.all([
		capture(readSubscriptionStatus(session, dependencies)),
		capture(readDevices(session, dependencies)),
		capture(readVaults(session, dependencies)),
	])
	const authFailure = getCapturedAuthFailure([subscription, devices, vaults])

	if (authFailure) throw authFailure

	return {
		subscription: subscription.ok
			? ({ available: true, status: subscription.value } satisfies AccountSubscriptionResult)
			: ({
					available: false,
					message: "Plan details are temporarily unavailable.",
				} satisfies AccountSubscriptionResult),
		devices: devices.ok
			? ({ available: true, devices: devices.value } satisfies AccountDevicesResult)
			: ({
					available: false,
					message: "Devices are temporarily unavailable.",
				} satisfies AccountDevicesResult),
		vaults: vaults.ok
			? ({ available: true, vaults: vaults.value } satisfies AccountVaultsResult)
			: ({
					available: false,
					message: "Vaults are temporarily unavailable.",
				} satisfies AccountVaultsResult),
	}
}

export async function getAccountOverviewFromAuthSession(
	dependencies: AccountDependencies = {},
): Promise<AccountOverviewResult> {
	let session = dependencies.session ?? null

	if (!session) return { authenticated: false, redirectTo: "/login?redirect=/account" }

	if (!session.accessToken) {
		session = await refreshSessionOrUnauthenticated(session, dependencies)
		if (!session) return { authenticated: false, redirectTo: "/login?redirect=/account" }
	}

	try {
		const accountData = await readAccountData(session, dependencies)

		return {
			authenticated: true,
			...accountData,
			session: toPublicSession(session),
		}
	} catch (error) {
		if (isAuthFailure(error)) {
			const refreshedSession = await refreshSessionOrUnauthenticated(session, dependencies)
			if (!refreshedSession) {
				return { authenticated: false, redirectTo: "/login?redirect=/account" }
			}

			try {
				const accountData = await readAccountData(refreshedSession, dependencies)

				return {
					authenticated: true,
					...accountData,
					session: toPublicSession(refreshedSession),
				}
			} catch (retryError) {
				if (isAuthFailure(retryError)) {
					dependencies.onSessionCleared?.()
					return { authenticated: false, redirectTo: "/login?redirect=/account" }
				}

				return {
					authenticated: true,
					session: toPublicSession(refreshedSession),
					subscription: {
						available: false,
						message: "Plan details are temporarily unavailable.",
					},
					devices: {
						available: false,
						message: "Devices are temporarily unavailable.",
					},
					vaults: {
						available: false,
						message: "Vaults are temporarily unavailable.",
					},
				}
			}
		}

		return {
			authenticated: true,
			session: toPublicSession(session),
			subscription: {
				available: false,
				message: "Plan details are temporarily unavailable.",
			},
			devices: {
				available: false,
				message: "Devices are temporarily unavailable.",
			},
			vaults: {
				available: false,
				message: "Vaults are temporarily unavailable.",
			},
		}
	}
}

export const getAccountOverview = createServerFn({ method: "GET" }).handler(async () => {
	const { clearAuthSessionCookies, readAuthSessionFromCookies, setAuthSessionCookies } =
		await import("./auth-cookies.server")

	return getAccountOverviewFromAuthSession({
		onSessionCleared: clearAuthSessionCookies,
		onSessionRefreshed: setAuthSessionCookies,
		session: readAuthSessionFromCookies(),
	})
})
