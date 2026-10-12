import { useVaultStore } from "@cortex/core"
import { useEffect } from "react"
import { mainWindowActions } from "./mainWindowActions"
import { MIRRORED_STORES } from "./mirroredStores"
import { startWindowBridge } from "./windowBridge"

export function useMainWindowBridge(): void {
	useEffect(() => {
		const bridge = startWindowBridge({
			role: "main",
			mirrors: MIRRORED_STORES,
			getVault: () => useVaultStore.getState().vault,
			actions: mainWindowActions,
		})
		bridge.publishSnapshot()
		const unsubscribeVault = useVaultStore.subscribe((state, previous) => {
			if (state.vault !== previous.vault) bridge.publishSnapshot()
		})
		return () => {
			unsubscribeVault()
			bridge.dispose()
		}
	}, [])
}
