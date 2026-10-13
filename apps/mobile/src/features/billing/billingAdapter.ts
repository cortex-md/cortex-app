import {
	BILLING_URL,
	requiresCloudEntitlement,
	resolveSyncServerUrl,
	useAuthStore,
	useRemoteVaultStore,
	useSubscriptionStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"

import {
	type AccountSummary,
	FIXTURE_ACCOUNT,
	FIXTURE_ENTITLED,
	FIXTURE_HOSTED_SYNC_PLAN,
	type HostedSyncPlan,
} from "@/features/billing/billingFixtures"

export function useAccountSummary(): AccountSummary {
	// stub: the fixture account stands in while nobody is signed in on this device
	const user = useAuthStore((state) => state.user)
	if (!user) return FIXTURE_ACCOUNT
	return { displayName: user.displayName ?? user.email, email: user.email }
}

export interface HostedSyncEntitlement {
	entitled: boolean
	planLabel: string
	locked: boolean
}

export function getHostedSyncPlan(): HostedSyncPlan {
	// stub: plan copy and pricing come from the fixture until billing is wired on mobile
	return FIXTURE_HOSTED_SYNC_PLAN
}

export function useHostedSyncEntitlement(): HostedSyncEntitlement {
	// stub: falls back to the fixture entitlement when the server status has not been fetched
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const statusByServer = useSubscriptionStore((state) => state.statusByServer)
	const serverUrl = resolveSyncServerUrl(syncConfig)
	const cached = statusByServer[serverUrl]?.status
	const entitled = cached ? cached.entitled : FIXTURE_ENTITLED
	return {
		entitled,
		locked: requiresCloudEntitlement(syncConfig) && !entitled,
		planLabel: entitled ? FIXTURE_HOSTED_SYNC_PLAN.name : "Free",
	}
}

export async function openUpgradeCheckout(): Promise<void> {
	// stub: purchase path (App Store IAP / Play Billing / web checkout) is not implemented; opens the billing page
	await getPlatform().app.openExternalUrl(BILLING_URL)
}
