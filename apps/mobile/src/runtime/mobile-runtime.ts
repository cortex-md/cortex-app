import { noteCache, useAppStore, useVaultStore } from "@cortex/core"
import { useEffect } from "react"

let noteCacheStarted = false

function startNoteCache(): void {
	if (noteCacheStarted) return
	noteCache.start()
	noteCacheStarted = true
}

function stopNoteCache(): void {
	if (!noteCacheStarted) return
	noteCache.stop()
	noteCacheStarted = false
}

export function useMobileRuntime(): void {
	const loadAppInfo = useAppStore((state) => state.loadAppInfo)
	const loadFirstRunOnboarding = useAppStore((state) => state.loadFirstRunOnboarding)
	const loadRecentVaults = useVaultStore((state) => state.loadRecentVaults)
	const openVault = useVaultStore((state) => state.openVault)

	useEffect(() => {
		let canceled = false
		startNoteCache()

		void (async () => {
			await Promise.all([loadAppInfo(), loadFirstRunOnboarding(), loadRecentVaults()])
			if (canceled || useVaultStore.getState().vault) return

			const recentVault = useVaultStore.getState().recentVaults[0]
			if (!recentVault) return

			await openVault(recentVault.path, { name: recentVault.name })
		})()

		return () => {
			canceled = true
			stopNoteCache()
		}
	}, [loadAppInfo, loadFirstRunOnboarding, loadRecentVaults, openVault])
}
