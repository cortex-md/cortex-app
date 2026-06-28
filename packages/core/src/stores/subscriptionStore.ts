import type { SubscriptionBlockCode, SubscriptionStatus } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { BILLING_URL, normalizeServerUrl } from "../sync/serverConfig"

const SUBSCRIPTION_CACHE_TTL_MS = 60_000

export interface SubscriptionCacheEntry {
	status: SubscriptionStatus
	checkedAt: number
}

export interface SubscriptionBlock {
	code: SubscriptionBlockCode
	message: string
}

export interface SubscriptionState {
	statusByServer: Record<string, SubscriptionCacheEntry>
	loading: boolean
	error: string | null
	block: SubscriptionBlock | null

	refreshStatus: (serverUrl: string, options?: { force?: boolean }) => Promise<SubscriptionStatus>
	ensureCloudEntitlement: (serverUrl: string, options?: { force?: boolean }) => Promise<void>
	openBillingPage: () => Promise<string>
	clearBlock: () => void
	clearServer: (serverUrl: string) => void
}

function createInactiveStatus(): SubscriptionStatus {
	return {
		status: "none",
		entitled: false,
		currentPeriodStart: null,
		currentPeriodEnd: null,
		entitlementExpiresAt: null,
		billingCycle: null,
		planProductId: null,
	}
}

function getBlockForStatus(status: SubscriptionStatus): SubscriptionBlock | null {
	if (status.entitled) return null
	const code: SubscriptionBlockCode =
		status.status === "expired" || status.status === "cancelled"
			? "subscription_expired"
			: "subscription_required"
	return {
		code,
		message:
			code === "subscription_expired"
				? "Your Cortex Cloud plan has expired. Renew your plan to resume sync."
				: "A Cortex Cloud plan is required to sync with Cortex Cloud.",
	}
}

function getCachedStatus(
	statusByServer: Record<string, SubscriptionCacheEntry>,
	serverUrl: string,
	now: number,
): SubscriptionStatus | null {
	const cached = statusByServer[serverUrl]
	if (!cached) return null
	if (now - cached.checkedAt > SUBSCRIPTION_CACHE_TTL_MS) return null
	return cached.status
}

export const useSubscriptionStore = create<SubscriptionState>()(
	devtools(
		immer((set, get) => ({
			statusByServer: {},
			loading: false,
			error: null,
			block: null,

			refreshStatus: async (serverUrl, options) => {
				const normalizedServerUrl = normalizeServerUrl(serverUrl)
				const now = Date.now()
				if (!options?.force) {
					const cached = getCachedStatus(get().statusByServer, normalizedServerUrl, now)
					if (cached) {
						set((state) => {
							state.block = getBlockForStatus(cached)
						})
						return cached
					}
				}

				set((state) => {
					state.loading = true
					state.error = null
				})
				try {
					const status = await getPlatform().subscription.getStatus(normalizedServerUrl)
					set((state) => {
						state.statusByServer[normalizedServerUrl] = {
							status,
							checkedAt: Date.now(),
						}
						state.loading = false
						state.block = getBlockForStatus(status)
					})
					return status
				} catch (error) {
					set((state) => {
						state.loading = false
						state.error = String(error)
					})
					throw error
				}
			},

			ensureCloudEntitlement: async (serverUrl, options) => {
				const status = await get().refreshStatus(serverUrl, options)
				const block = getBlockForStatus(status)
				if (!block) {
					set((state) => {
						state.block = null
					})
					return
				}
				set((state) => {
					state.block = block
				})
				throw new Error(block.message)
			},

			openBillingPage: async () => {
				set((state) => {
					state.loading = true
					state.error = null
				})
				try {
					await getPlatform().app.openExternalUrl(BILLING_URL)
					set((state) => {
						state.loading = false
					})
					return BILLING_URL
				} catch (error) {
					set((state) => {
						state.loading = false
						state.error = String(error)
					})
					throw error
				}
			},

			clearBlock: () =>
				set((state) => {
					state.block = null
				}),

			clearServer: (serverUrl) =>
				set((state) => {
					delete state.statusByServer[normalizeServerUrl(serverUrl)]
					state.block = null
				}),
		})),
		{ name: "subscriptionStore" },
	),
)

export function createSubscriptionRequiredStatus(): SubscriptionStatus {
	return createInactiveStatus()
}
