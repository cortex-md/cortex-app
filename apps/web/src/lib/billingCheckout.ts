export const BILLING_RETURN_URL = "cortex://billing/cancelled?status=cancelled"
export const BILLING_COMPLETION_URL = "cortex://sync/checkout-complete"

export interface BillingCheckoutContext {
	token: string
	deviceId: string
	serverUrl: string
}

interface CheckoutResponsePayload {
	checkout_url?: unknown
}

export function normalizeSyncServerUrl(value: string) {
	const trimmedValue = value.trim()

	if (!trimmedValue) return null

	try {
		const url = new URL(trimmedValue)
		if (url.protocol !== "http:" && url.protocol !== "https:") return null
		url.hash = ""
		url.search = ""
		return url.toString().replace(/\/$/, "")
	} catch {
		return null
	}
}

export function readBillingContextFromHash(hash: string): BillingCheckoutContext | null {
	const hashValue = hash.startsWith("#") ? hash.slice(1) : hash
	const params = new URLSearchParams(hashValue)
	const token = params.get("token")?.trim() || params.get("access_token")?.trim()
	const deviceId = params.get("device_id")?.trim() || params.get("deviceId")?.trim()
	const serverUrl = normalizeSyncServerUrl(
		params.get("server_url")?.trim() || params.get("serverUrl")?.trim() || "",
	)

	if (!token || !deviceId || !serverUrl) return null

	return { token, deviceId, serverUrl }
}

export async function createBillingCheckout(
	context: BillingCheckoutContext,
	fetcher: typeof fetch = globalThis.fetch,
) {
	const response = await fetcher(`${context.serverUrl}/subscription/v1/checkout`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${context.token}`,
			"Content-Type": "application/json",
			"X-Device-ID": context.deviceId,
		},
		body: JSON.stringify({
			return_url: BILLING_RETURN_URL,
			completion_url: BILLING_COMPLETION_URL,
		}),
	})

	if (!response.ok) {
		throw new Error("Cortex Sync could not create a checkout. Please try again from the app.")
	}

	let payload: CheckoutResponsePayload
	try {
		payload = (await response.json()) as CheckoutResponsePayload
	} catch {
		throw new Error("Cortex Sync returned an unreadable checkout response.")
	}

	if (typeof payload.checkout_url !== "string") {
		throw new Error("Cortex Sync did not return a checkout URL.")
	}

	try {
		const checkoutUrl = new URL(payload.checkout_url)
		if (checkoutUrl.protocol !== "http:" && checkoutUrl.protocol !== "https:") {
			throw new Error("Unsafe checkout URL.")
		}
		return checkoutUrl.toString()
	} catch {
		throw new Error("Cortex Sync returned an invalid checkout URL.")
	}
}
