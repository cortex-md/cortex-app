import * as http from "./httpClient"

export interface SubscriptionStatus {
	status: string
	entitled: boolean
	currentPeriodStart: string | null
	currentPeriodEnd: string | null
	entitlementExpiresAt: string | null
	billingCycle: string | null
	planProductId: string | null
}

interface SubscriptionStatusResponse {
	status: string
	entitled: boolean
	current_period_start?: string | null
	current_period_end?: string | null
	entitlement_expires_at?: string | null
	billing_cycle?: string | null
	plan_product_id?: string | null
}

export async function subscriptionGetStatus(serverUrl: string): Promise<SubscriptionStatus> {
	http.setServerUrl(serverUrl)
	const response = await http.get("/subscription/v1/status")
	if (response.status === 404) {
		return {
			status: "disabled",
			entitled: true,
			currentPeriodStart: null,
			currentPeriodEnd: null,
			entitlementExpiresAt: null,
			billingCycle: null,
			planProductId: null,
		}
	}
	const raw = await http.parseResponse<SubscriptionStatusResponse>(response)
	return {
		status: raw.status,
		entitled: raw.entitled,
		currentPeriodStart: raw.current_period_start ?? null,
		currentPeriodEnd: raw.current_period_end ?? null,
		entitlementExpiresAt: raw.entitlement_expires_at ?? null,
		billingCycle: raw.billing_cycle ?? null,
		planProductId: raw.plan_product_id ?? null,
	}
}
