import { useAuthStore, useMembersStore, useRemoteVaultStore, useSyncStore } from "@cortex/core"
import { useEffect } from "react"

const FOCUS_REFRESH_INTERVAL_MS = 60_000

export function useVaultOverviewRefresh() {
	const authenticated = useAuthStore((state) => state.authenticated)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const syncActive = useSyncStore(
		(state) => state.engineState !== "idle" && state.engineState !== "denied",
	)

	useEffect(() => {
		if (!authenticated || !linkedVaultId || !syncActive) return
		let lastRefresh = Date.now()
		void useMembersStore.getState().fetchOverview(linkedVaultId)
		const refreshOnFocus = () => {
			if (Date.now() - lastRefresh < FOCUS_REFRESH_INTERVAL_MS) return
			lastRefresh = Date.now()
			void useMembersStore.getState().fetchOverview(linkedVaultId)
		}
		window.addEventListener("focus", refreshOnFocus)
		return () => window.removeEventListener("focus", refreshOnFocus)
	}, [authenticated, linkedVaultId, syncActive])
}
