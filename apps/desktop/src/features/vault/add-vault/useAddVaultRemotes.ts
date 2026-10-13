import {
	loadVaultListItems,
	requiresCloudEntitlement,
	resolveSyncServerUrl,
	useAuthStore,
	useRemoteVaultStore,
	useSubscriptionStore,
	useVaultStore,
	type VaultListItem,
} from "@cortex/core"
import type { RemoteVaultInfo } from "@cortex/platform"
import { useEffect, useState } from "react"
import { getSyncServerLabel } from "../../sync/serverLabel"
import { getVaultDisplayPath } from "../vaultDisplay"

export interface RemoteVaultOption {
	remote: RemoteVaultInfo
	description: string
	takenBy: VaultListItem | null
}

function capitalize(value: string): string {
	return value ? value[0]?.toUpperCase() + value.slice(1) : value
}

export function describeRemoteVault(remote: RemoteVaultInfo): string {
	const members = remote.memberCount ?? 1
	const memberLabel = members === 1 ? "only you" : `${members} members`
	if (remote.role === "owner") return members === 1 ? "Yours · only you" : `Yours · ${memberLabel}`
	return `Shared with you · ${capitalize(remote.role)} · ${memberLabel}`
}

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

	const options: RemoteVaultOption[] = remoteVaults.map((remote) => {
		const takenBy = localItems.find((item) => item.remoteVaultId === remote.id) ?? null
		return {
			remote,
			takenBy,
			description: takenBy
				? `Already on this Mac at ${getVaultDisplayPath(takenBy.entry)}`
				: describeRemoteVault(remote),
		}
	})

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
