import {
	type DeviceEntry,
	getSubscriptionStatus,
	listDevices,
	listRemoteVaults,
	mapDevices,
	mapRemoteVaults,
	type RemoteVaultInfo,
	revokeDevice,
	type SubscriptionStatus,
} from "@cortex/sync-api"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
	createSessionClient,
	isAuthFailure,
	resolveActiveSession,
	type SessionDependencies,
} from "./sync/api"

export type { SubscriptionStatus } from "@cortex/sync-api"

export interface AccountPublicSession {
	email: string
}

export interface AccountDeviceSummary {
	id: string
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

export type RevokeAccountDeviceResult =
	| { ok: true }
	| { ok: false; code: "unauthenticated"; redirectTo: string }
	| { ok: false; code: "failed"; message: string }

const accountLoginPath = "/login?redirect=/account"

const unauthenticatedResult: AccountOverviewResult = {
	authenticated: false,
	redirectTo: accountLoginPath,
}

function normalizeVaultRole(role: string): AccountVaultRole {
	const normalizedRole = role.toLowerCase()
	if (
		normalizedRole === "admin" ||
		normalizedRole === "editor" ||
		normalizedRole === "owner" ||
		normalizedRole === "viewer"
	) {
		return normalizedRole
	}
	return "unknown"
}

function toDeviceSummary(device: DeviceEntry): AccountDeviceSummary {
	return {
		id: device.id,
		name: device.deviceName,
		type: device.deviceType,
		isCurrent: device.isCurrent === true,
		isRevoked: device.revoked,
		lastSeenAt: device.lastSeenAt,
		createdAt: device.createdAt || null,
	}
}

function toVaultSummary(vault: RemoteVaultInfo): AccountVaultSummary {
	return {
		name: vault.name,
		description: vault.description,
		role: normalizeVaultRole(vault.role),
		memberCount: vault.memberCount,
		updatedAt: vault.updatedAt || null,
	}
}

export function normalizeAccountDevices(payload: unknown): AccountDeviceSummary[] {
	return mapDevices(payload).map(toDeviceSummary)
}

export function normalizeAccountVaults(payload: unknown): AccountVaultSummary[] {
	return mapRemoteVaults(payload).map(toVaultSummary)
}

type CapturedResult<T> = { ok: true; value: T } | { error: unknown; ok: false }

async function capture<T>(promise: Promise<T>): Promise<CapturedResult<T>> {
	try {
		return { ok: true, value: await promise }
	} catch (error) {
		return { error, ok: false }
	}
}

function hasAuthFailure(results: Array<CapturedResult<unknown>>) {
	return results.some((result) => !result.ok && isAuthFailure(result.error))
}

export async function getAccountOverviewFromAuthSession(
	dependencies: SessionDependencies = {},
): Promise<AccountOverviewResult> {
	const session = await resolveActiveSession(dependencies)

	if (!session) return unauthenticatedResult

	const { api, getSession } = createSessionClient(session, dependencies)
	const [subscription, devices, vaults] = await Promise.all([
		capture(getSubscriptionStatus(api)),
		capture(listDevices(api)),
		capture(listRemoteVaults(api)),
	])

	if (hasAuthFailure([subscription, devices, vaults])) {
		dependencies.onSessionCleared?.()
		return unauthenticatedResult
	}

	return {
		authenticated: true,
		session: { email: getSession().email },
		subscription: subscription.ok
			? { available: true, status: subscription.value }
			: { available: false, message: "Plan details are temporarily unavailable." },
		devices: devices.ok
			? { available: true, devices: devices.value.map(toDeviceSummary) }
			: { available: false, message: "Devices are temporarily unavailable." },
		vaults: vaults.ok
			? { available: true, vaults: vaults.value.map(toVaultSummary) }
			: { available: false, message: "Vaults are temporarily unavailable." },
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

const revokeDeviceSchema = z.object({ deviceId: z.string().trim().min(1).max(200) })

export async function revokeAccountDeviceFromAuthSession(
	deviceId: string,
	dependencies: SessionDependencies = {},
): Promise<RevokeAccountDeviceResult> {
	const session = await resolveActiveSession(dependencies)

	if (!session) return { ok: false, code: "unauthenticated", redirectTo: accountLoginPath }

	const { api } = createSessionClient(session, dependencies)

	try {
		await revokeDevice(api, deviceId)
		return { ok: true }
	} catch (error) {
		if (isAuthFailure(error)) {
			dependencies.onSessionCleared?.()
			return { ok: false, code: "unauthenticated", redirectTo: accountLoginPath }
		}
		return { ok: false, code: "failed", message: "Couldn’t sign out that device. Try again." }
	}
}

export const revokeAccountDevice = createServerFn({ method: "POST" })
	.validator(revokeDeviceSchema)
	.handler(async ({ data }) => {
		const { clearAuthSessionCookies, readAuthSessionFromCookies, setAuthSessionCookies } =
			await import("./auth-cookies.server")

		return revokeAccountDeviceFromAuthSession(data.deviceId, {
			onSessionCleared: clearAuthSessionCookies,
			onSessionRefreshed: setAuthSessionCookies,
			session: readAuthSessionFromCookies(),
		})
	})
