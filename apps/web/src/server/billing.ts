import {
	createCheckout,
	getSubscriptionStatus,
	mapSubscriptionStatus,
	type SubscriptionStatus,
	SyncError,
} from "@cortex/sync-api"
import { createServerFn } from "@tanstack/react-start"
import {
	createSessionClient,
	isAuthFailure,
	resolveActiveSession,
	type SessionDependencies,
} from "./sync/api"
import { getBillingCompletionUrl, getBillingReturnUrl } from "./sync/config"

export type { SubscriptionStatus } from "@cortex/sync-api"

export const normalizeSubscriptionStatus = mapSubscriptionStatus

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

const unauthenticatedResult: CheckoutSessionResult = {
	ok: false,
	code: "unauthenticated",
	redirectTo: "/login?redirect=/billing",
	message: "Sign in to continue to Cortex Sync checkout.",
}

function checkoutErrorMessage(error: unknown) {
	if (error instanceof SyncError) return error.detail ?? "Cortex Sync is temporarily unavailable."
	if (error instanceof Error) return error.message
	return "Cortex Sync could not create a checkout. Try again in a moment."
}

export async function createCheckoutFromAuthSession(
	dependencies: SessionDependencies = {},
): Promise<CheckoutSessionResult> {
	const session = await resolveActiveSession(dependencies)

	if (!session) return unauthenticatedResult

	const { api } = createSessionClient(session, dependencies)

	try {
		const subscription = await getSubscriptionStatus(api)

		if (subscription.status === "disabled") {
			return {
				ok: false,
				code: "checkout_unavailable",
				message: "Hosted billing is not available on this Cortex Sync server.",
			}
		}

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
			checkoutUrl: await createCheckout(api, {
				returnUrl: getBillingReturnUrl(dependencies.env),
				completionUrl: getBillingCompletionUrl(dependencies.env),
			}),
		}
	} catch (error) {
		if (isAuthFailure(error)) {
			dependencies.onSessionCleared?.()
			return unauthenticatedResult
		}

		return { ok: false, code: "checkout_unavailable", message: checkoutErrorMessage(error) }
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
