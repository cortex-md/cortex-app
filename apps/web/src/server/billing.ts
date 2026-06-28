import { createServerFn } from "@tanstack/react-start"
import { type AuthSession, refreshAuthSession } from "./auth"
import { SyncApiError, syncRequest } from "./sync/client"
import { getBillingCompletionUrl, getBillingReturnUrl, type SyncRuntimeEnv } from "./sync/config"

interface CheckoutResponse {
	checkout_url?: unknown
}

export interface SubscriptionStatusResponse {
	billing_cycle?: unknown
	current_period_end?: unknown
	current_period_start?: unknown
	entitled?: unknown
	entitlement_expires_at?: unknown
	plan_product_id?: unknown
	status?: unknown
}

export interface SubscriptionStatus {
	billingCycle: string | null
	currentPeriodEnd: string | null
	currentPeriodStart: string | null
	entitled: boolean
	entitlementExpiresAt: string | null
	planProductId: string | null
	status: "active" | "cancelled" | "expired" | "none" | "pending" | "unknown"
}

export type CheckoutSessionResult =
	| { ok: true; checkoutUrl: string }
	| {
			ok: true
			code: "subscription_active"
			message: string
			redirectTo: string
			subscription: SubscriptionStatus
	  }
	| { ok: false; code: "unauthenticated"; redirectTo: string; message: string }
	| { ok: false; code: "checkout_unavailable"; message: string }

interface CheckoutDependencies {
	env?: SyncRuntimeEnv
	fetcher?: typeof fetch
	onSessionCleared?: () => void
	onSessionRefreshed?: (session: AuthSession) => void
	session?: AuthSession | null
}

const unauthenticatedResult: CheckoutSessionResult = {
	ok: false,
	code: "unauthenticated",
	redirectTo: "/login?redirect=/billing",
	message: "Sign in to continue to Cortex Sync checkout.",
}

function normalizeString(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null
}

export function normalizeSubscriptionStatus(
	payload: SubscriptionStatusResponse,
): SubscriptionStatus {
	const rawStatus = normalizeString(payload.status)?.toLowerCase()
	const status =
		rawStatus === "active" ||
		rawStatus === "cancelled" ||
		rawStatus === "expired" ||
		rawStatus === "none" ||
		rawStatus === "pending"
			? rawStatus
			: "unknown"

	return {
		status,
		entitled: payload.entitled === true,
		currentPeriodStart: normalizeString(payload.current_period_start),
		currentPeriodEnd: normalizeString(payload.current_period_end),
		entitlementExpiresAt: normalizeString(payload.entitlement_expires_at),
		billingCycle: normalizeString(payload.billing_cycle),
		planProductId: normalizeString(payload.plan_product_id),
	}
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

function normalizeCheckoutUrl(value: unknown) {
	if (typeof value !== "string") return null

	try {
		const checkoutUrl = new URL(value)
		if (checkoutUrl.protocol !== "http:" && checkoutUrl.protocol !== "https:") return null
		return checkoutUrl.toString()
	} catch {
		return null
	}
}

async function createCheckout(session: AuthSession, dependencies: CheckoutDependencies) {
	const payload = await syncRequest<CheckoutResponse>("/subscription/v1/checkout", {
		method: "POST",
		accessToken: session.accessToken,
		deviceId: session.deviceId,
		body: {
			return_url: getBillingReturnUrl(dependencies.env),
			completion_url: getBillingCompletionUrl(dependencies.env),
		},
		env: dependencies.env,
		fetcher: dependencies.fetcher,
	})
	const checkoutUrl = normalizeCheckoutUrl(payload.checkout_url)

	if (!checkoutUrl) {
		throw new Error("Cortex Sync did not return a checkout URL.")
	}

	return checkoutUrl
}

async function getSubscriptionStatus(
	session: AuthSession,
	dependencies: CheckoutDependencies,
): Promise<SubscriptionStatus> {
	const payload = await syncRequest<SubscriptionStatusResponse>("/subscription/v1/status", {
		accessToken: session.accessToken,
		deviceId: session.deviceId,
		env: dependencies.env,
		fetcher: dependencies.fetcher,
	})

	return normalizeSubscriptionStatus(payload)
}

async function refreshSessionOrUnauthenticated(
	session: AuthSession,
	dependencies: CheckoutDependencies,
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

export async function createCheckoutFromAuthSession(
	dependencies: CheckoutDependencies = {},
): Promise<CheckoutSessionResult> {
	let session = dependencies.session ?? null

	if (!session) return unauthenticatedResult

	if (!session.accessToken) {
		session = await refreshSessionOrUnauthenticated(session, dependencies)
		if (!session) return unauthenticatedResult
	}

	try {
		const subscription = await getSubscriptionStatus(session, dependencies)

		if (subscription.entitled) {
			return {
				ok: true,
				code: "subscription_active",
				redirectTo: "/account",
				message: "Your hosted Cortex Sync plan is already active.",
				subscription,
			}
		}

		return {
			ok: true,
			checkoutUrl: await createCheckout(session, dependencies),
		}
	} catch (error) {
		if (isAuthFailure(error)) {
			const refreshedSession = await refreshSessionOrUnauthenticated(session, dependencies)
			if (!refreshedSession) return unauthenticatedResult

			try {
				const subscription = await getSubscriptionStatus(refreshedSession, dependencies)

				if (subscription.entitled) {
					return {
						ok: true,
						code: "subscription_active",
						redirectTo: "/account",
						message: "Your hosted Cortex Sync plan is already active.",
						subscription,
					}
				}

				return {
					ok: true,
					checkoutUrl: await createCheckout(refreshedSession, dependencies),
				}
			} catch (retryError) {
				if (isAuthFailure(retryError)) {
					dependencies.onSessionCleared?.()
					return unauthenticatedResult
				}
			}
		}

		return {
			ok: false,
			code: "checkout_unavailable",
			message:
				error instanceof Error
					? error.message
					: "Cortex Sync could not create a checkout. Try again in a moment.",
		}
	}
}

export const startBillingFromAuthSession = createCheckoutFromAuthSession

export const startBillingFromSession = createServerFn({ method: "POST" }).handler(async () => {
	const { clearAuthSessionCookies, readAuthSessionFromCookies, setAuthSessionCookies } =
		await import("./auth-cookies.server")

	return createCheckoutFromAuthSession({
		onSessionCleared: clearAuthSessionCookies,
		onSessionRefreshed: setAuthSessionCookies,
		session: readAuthSessionFromCookies(),
	})
})

export const createCheckoutFromSession = startBillingFromSession
