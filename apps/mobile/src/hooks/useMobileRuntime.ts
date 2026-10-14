import {
	bootstrapApp,
	flushPendingWrites,
	getErrorMessage,
	openLastVault,
	startAppRuntime,
	startSyncLifecycle,
	useVaultStore,
} from "@cortex/core"
import { useHotkeysStore } from "@cortex/hotkeys"
import { useEffect, useState } from "react"
import { AppState } from "react-native"

import { startMobileThemeSync } from "@/features/themes/themeSync"
import { cleanErrorMessage } from "@/features/vault/vaultErrors"
import { getMobileVaultAccess } from "@/platform/vaultAccess"

export interface MobileRuntimeState {
	ready: boolean
	startupError: string | null
}

async function describeStartupError(error: unknown): Promise<string | null> {
	const lastVault = useVaultStore.getState().recentVaults[0]
	if (lastVault && (await getMobileVaultAccess(lastVault.path)) === "needsAccess") return null
	return cleanErrorMessage(getErrorMessage(error))
}

export function useMobileRuntime(): MobileRuntimeState {
	const [state, setState] = useState<MobileRuntimeState>({ ready: false, startupError: null })

	useEffect(() => {
		let canceled = false
		const stopAppRuntime = startAppRuntime({
			persistWorkspace: false,
			indexing: "lazy",
			onVaultOpened: (vault) => void useHotkeysStore.getState().loadOverrides(vault.path),
		})
		const stopSyncLifecycle = startSyncLifecycle()
		const stopThemeSync = startMobileThemeSync()
		const appStateSubscription = AppState.addEventListener("change", (appState) => {
			if (appState === "background" || appState === "inactive") void flushPendingWrites()
		})

		void bootstrapApp()
			.then(openLastVault)
			.then(
				() => null,
				(error: unknown) => describeStartupError(error),
			)
			.then((startupError) => {
				if (!canceled) setState({ ready: true, startupError })
			})

		return () => {
			canceled = true
			appStateSubscription.remove()
			stopThemeSync()
			stopSyncLifecycle()
			stopAppRuntime()
		}
	}, [])

	return state
}
