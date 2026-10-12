import {
	DEFAULT_CLOUD_SYNC_SERVER_URL,
	useSubscriptionStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useEffect } from "react"
import {
	SYNC_WELCOME_MARKDOWN,
	SYNC_WELCOME_TITLE,
	SYNC_WELCOME_VIEW_ID,
} from "../features/sync/syncWelcome"

export function isSyncCheckoutCompleteDeepLink(value: string): boolean {
	try {
		const url = new URL(value)
		return (
			url.protocol === "cortex:" && url.hostname === "sync" && url.pathname === "/checkout-complete"
		)
	} catch {
		return false
	}
}

function startSyncBillingDeepLinks(): () => void {
	let processing = false
	let welcomeOpened = false

	const handleDeepLinkUrls = async (urls: string[]) => {
		if (!urls.some(isSyncCheckoutCompleteDeepLink) || processing) return
		processing = true
		try {
			const subscription = useSubscriptionStore.getState()
			const status = await subscription.refreshStatus(DEFAULT_CLOUD_SYNC_SERVER_URL, {
				force: true,
			})
			if (!status.entitled) return

			subscription.clearBlock()
			if (!useVaultStore.getState().vault || welcomeOpened) return

			welcomeOpened = true
			useWorkspaceStore.getState().openViewTab(SYNC_WELCOME_VIEW_ID, SYNC_WELCOME_TITLE, {
				ephemeral: true,
				viewState: { content: SYNC_WELCOME_MARKDOWN },
			})
		} catch (error) {
			console.error("[Sync billing deep link failed]", { error })
		} finally {
			processing = false
		}
	}

	return getPlatform().app.onDeepLinkOpen((urls) => {
		void handleDeepLinkUrls(urls)
	})
}

export function useSyncBillingDeepLink() {
	useEffect(() => startSyncBillingDeepLinks(), [])
}
