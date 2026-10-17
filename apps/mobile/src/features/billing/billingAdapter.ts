import {
	requiresCloudEntitlement,
	resolveSyncServerUrl,
	useAuthStore,
	useRemoteVaultStore,
	useSubscriptionStore,
} from "@cortex/core"
import { useEffect } from "react"

import { HOSTED_SYNC_PLAN, type HostedSyncPlan } from "@/features/billing/billingPlan"
import { type PurchaseResult, selectPurchaseProvider } from "@/features/billing/purchaseProvider"

export interface HostedSyncEntitlement {
	entitled: boolean
	planLabel: string
	locked: boolean
}

export function getHostedSyncPlan(): HostedSyncPlan {
	return HOSTED_SYNC_PLAN
}

export function useHostedSyncEntitlement(): HostedSyncEntitlement {
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const statusByServer = useSubscriptionStore((state) => state.statusByServer)
	const authenticated = useAuthStore((state) => state.authenticated)
	const serverUrl = resolveSyncServerUrl(syncConfig)
	const cached = statusByServer[serverUrl]?.status
	useEffect(() => {
		if (!authenticated || cached) return
		void useSubscriptionStore
			.getState()
			.refreshStatus(serverUrl)
			.catch(() => undefined)
	}, [authenticated, cached, serverUrl])
	const entitled = cached?.entitled ?? false
	return {
		entitled,
		locked: requiresCloudEntitlement(syncConfig) && !entitled,
		planLabel: entitled ? HOSTED_SYNC_PLAN.name : "Free",
	}
}

export function openUpgradeCheckout(): Promise<PurchaseResult> {
	return selectPurchaseProvider().purchase("hosted-sync")
}
