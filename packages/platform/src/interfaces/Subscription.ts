export type SubscriptionBlockCode = "subscription_required" | "subscription_expired"

export interface SubscriptionStatus {
	status: string
	entitled: boolean
	currentPeriodStart: string | null
	currentPeriodEnd: string | null
	entitlementExpiresAt: string | null
	billingCycle: string | null
	planProductId: string | null
}

export interface Subscription {
	getStatus(serverUrl: string): Promise<SubscriptionStatus>
}
