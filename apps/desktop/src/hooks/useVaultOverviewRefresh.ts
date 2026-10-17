import {
	startVaultOverviewRefresh,
	useAuthStore,
	useRemoteVaultStore,
	useSyncStore,
} from "@cortex/core"
import { useEffect } from "react"
import { onWindowFocus } from "@/utils/windowFocus"

export function useVaultOverviewRefresh() {
	const authenticated = useAuthStore((state) => state.authenticated)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const syncActive = useSyncStore(
		(state) => state.engineState !== "idle" && state.engineState !== "denied",
	)

	useEffect(() => {
		if (!authenticated || !linkedVaultId || !syncActive) return
		return startVaultOverviewRefresh(linkedVaultId, onWindowFocus)
	}, [authenticated, linkedVaultId, syncActive])
}
