import {
	buildRemoteVaultOptions,
	getSyncServerLabel,
	loadVaultListItems,
	requiresCloudEntitlement,
	resolveSyncServerUrl,
	useAuthStore,
	useRemoteVaultStore,
	useSubscriptionStore,
	useVaultStore,
	type VaultListItem,
} from "@cortex/core"
import { useEffect, useState } from "react"
import { DEVICE_LABEL } from "../deviceLabel"

export function useAddVaultRemotes() {
	const authenticated = useAuthStore((state) => state.authenticated)
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const loading = useRemoteVaultStore((state) => state.loading)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const fetchRemoteVaults = useRemoteVaultStore((state) => state.fetchRemoteVaults)
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const block = useSubscriptionStore((state) => state.block)
	const refreshStatus = useSubscriptionStore((state) => state.refreshStatus)
	const openBillingPage = useSubscriptionStore((state) => state.openBillingPage)
	const [localItems, setLocalItems] = useState<VaultListItem[]>([])

	useEffect(() => {
		if (!authenticated) return
		void fetchRemoteVaults()
		if (!syncConfig.selfHosted) {
			void refreshStatus(resolveSyncServerUrl(syncConfig)).catch(() => {})
		}
	}, [authenticated, fetchRemoteVaults, refreshStatus, syncConfig])

	useEffect(() => {
		let active = true
		void loadVaultListItems(recentVaults).then((items) => {
			if (active) setLocalItems(items)
		})
		return () => {
			active = false
		}
	}, [recentVaults])

	const options = buildRemoteVaultOptions(remoteVaults, localItems, DEVICE_LABEL)

	return {
		authenticated,
		loading,
		options,
		syncConfig,
		serverLabel: getSyncServerLabel(syncConfig),
		locked: requiresCloudEntitlement(syncConfig) && block !== null,
		openBillingPage: () => void openBillingPage().catch(() => {}),
	}
}
