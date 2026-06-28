import {
	DEFAULT_CLOUD_SYNC_SERVER_URL,
	useSubscriptionStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useEffect, useEffectEvent, useRef } from "react"
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

export function useSyncBillingDeepLink() {
	const vault = useVaultStore((state) => state.vault)
	const openViewTab = useWorkspaceStore((state) => state.openViewTab)
	const refreshStatus = useSubscriptionStore((state) => state.refreshStatus)
	const clearBlock = useSubscriptionStore((state) => state.clearBlock)
	const processingRef = useRef(false)
	const welcomeOpenedRef = useRef(false)

	const handleDeepLinkUrls = useEffectEvent(async (urls: string[]) => {
		if (!urls.some(isSyncCheckoutCompleteDeepLink)) return
		if (processingRef.current) return

		processingRef.current = true
		try {
			const status = await refreshStatus(DEFAULT_CLOUD_SYNC_SERVER_URL, { force: true })
			if (!status.entitled) return

			clearBlock()
			if (!vault || welcomeOpenedRef.current) return

			welcomeOpenedRef.current = true
			openViewTab(SYNC_WELCOME_VIEW_ID, SYNC_WELCOME_TITLE, {
				ephemeral: true,
				viewState: {
					content: SYNC_WELCOME_MARKDOWN,
				},
			})
		} catch (error) {
			console.error("[Sync billing deep link failed]", { error })
		} finally {
			processingRef.current = false
		}
	})

	useEffect(() => {
		let cancelled = false
		let unlisten: (() => void) | null = null

		void getPlatform()
			.app.onDeepLinkOpen((urls) => {
				void handleDeepLinkUrls(urls)
			})
			.then((nextUnlisten) => {
				if (cancelled) {
					nextUnlisten()
				} else {
					unlisten = nextUnlisten
				}
			})
			.catch((error) => {
				console.error("[Sync billing deep link subscription failed]", { error })
			})

		return () => {
			cancelled = true
			unlisten?.()
		}
	}, [])
}
