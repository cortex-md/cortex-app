import { noteCache, useAppStore, useVaultStore } from "@cortex/core"
import { useEffect, useState } from "react"

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

export function useMobileRuntime(): boolean {
	const loadAppInfo = useAppStore((state) => state.loadAppInfo)
	const loadFirstRunOnboarding = useAppStore((state) => state.loadFirstRunOnboarding)
	const loadRecentVaults = useVaultStore((state) => state.loadRecentVaults)
	const [ready, setReady] = useState(false)

	useEffect(() => {
		let canceled = false
		startNoteCache()

		void (async () => {
			await Promise.all([loadAppInfo(), loadFirstRunOnboarding(), loadRecentVaults()])
			if (!canceled) setReady(true)
		})()

		return () => {
			canceled = true
			stopNoteCache()
		}
	}, [loadAppInfo, loadFirstRunOnboarding, loadRecentVaults])

	return ready
}
