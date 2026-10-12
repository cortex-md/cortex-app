import {
	bootstrapApp,
	flushPendingWrites,
	getErrorMessage,
	openLastVault,
	startAppRuntime,
} from "@cortex/core"
import { useHotkeysStore } from "@cortex/hotkeys"
import { useEffect, useState } from "react"
import { AppState } from "react-native"

import { startMobileThemeSync } from "@/features/themes/themeSync"

export interface MobileRuntimeState {
	ready: boolean
	startupError: string | null
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
		const stopThemeSync = startMobileThemeSync()
		const appStateSubscription = AppState.addEventListener("change", (appState) => {
			if (appState === "background" || appState === "inactive") void flushPendingWrites()
		})

		void bootstrapApp()
			.then(openLastVault)
			.then(
				() => null,
				(error: unknown) => getErrorMessage(error),
			)
			.then((startupError) => {
				if (!canceled) setState({ ready: true, startupError })
			})

		return () => {
			canceled = true
			appStateSubscription.remove()
			stopThemeSync()
			stopAppRuntime()
		}
	}, [])

	return state
}
