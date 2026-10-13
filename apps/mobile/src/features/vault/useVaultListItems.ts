import {
	loadVaultListItems,
	useRemoteVaultStore,
	useVaultStore,
	type VaultListItem,
} from "@cortex/core"
import type { RemoteVaultInfo } from "@cortex/platform"
import { useEffect, useMemo, useState } from "react"
import { Platform } from "react-native"

export const DEVICE_LABEL = Platform.OS === "ios" ? "iPhone" : "phone"

export interface VaultListData {
	items: VaultListItem[]
	remoteOnly: RemoteVaultInfo[]
	loading: boolean
	refresh: () => void
}

export function useVaultListItems(): VaultListData {
	const recentVaults = useVaultStore((state) => state.recentVaults)
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const fetchRemoteVaults = useRemoteVaultStore((state) => state.fetchRemoteVaults)
	const [loaded, setLoaded] = useState<{ items: VaultListItem[]; source: unknown } | null>(null)
	const [generation, setGeneration] = useState(0)

	useEffect(() => {
		let cancelled = false
		void loadVaultListItems(recentVaults).then((items) => {
			if (!cancelled) setLoaded({ items, source: recentVaults })
		})
		void fetchRemoteVaults().catch(() => undefined)
		return () => {
			cancelled = true
		}
	}, [recentVaults, fetchRemoteVaults, generation])

	const items = useMemo(() => loaded?.items ?? [], [loaded])
	const loading = loaded?.source !== recentVaults

	const remoteOnly = useMemo(() => {
		const linked = new Set(items.map((item) => item.remoteVaultId).filter(Boolean))
		return remoteVaults.filter((remote) => !linked.has(remote.id))
	}, [items, remoteVaults])

	return {
		items,
		loading,
		refresh: () => setGeneration((value) => value + 1),
		remoteOnly,
	}
}
