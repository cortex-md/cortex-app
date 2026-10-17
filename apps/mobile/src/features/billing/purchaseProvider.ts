import {
	BILLING_URL,
	resolveSyncServerUrl,
	useRemoteVaultStore,
	useSubscriptionStore,
} from "@cortex/core"
import * as WebBrowser from "expo-web-browser"

export type PurchaseProviderId = "web-checkout" | "app-store" | "play-billing"

export type PurchaseResult = "purchased" | "pending" | "cancelled"

export interface PurchaseProvider {
	id: PurchaseProviderId
	isAvailable(): Promise<boolean>
	purchase(planId: string): Promise<PurchaseResult>
	restore(): Promise<void>
}

async function refreshEntitlement(): Promise<boolean> {
	const serverUrl = resolveSyncServerUrl(useRemoteVaultStore.getState().syncConfig)
	const status = await useSubscriptionStore.getState().refreshStatus(serverUrl, { force: true })
	return status.entitled
}

export const webCheckoutProvider: PurchaseProvider = {
	id: "web-checkout",
	isAvailable: async () => true,
	purchase: async () => {
		const result = await WebBrowser.openBrowserAsync(BILLING_URL)
		if (result.type === "cancel" || result.type === "dismiss") {
			return (await refreshEntitlement()) ? "purchased" : "cancelled"
		}
		return (await refreshEntitlement()) ? "purchased" : "pending"
	},
	restore: async () => {
		await refreshEntitlement()
	},
}

export function selectPurchaseProvider(): PurchaseProvider {
	return webCheckoutProvider
}
