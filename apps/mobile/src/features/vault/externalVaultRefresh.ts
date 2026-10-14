import { useVaultStore } from "@cortex/core"
import { AppState, Platform } from "react-native"

import { findMobileVaultRoot } from "@/platform/vaultRoots"

async function refreshIfProviderBacked(): Promise<void> {
	const vault = useVaultStore.getState().vault
	if (!vault) return
	const root = await findMobileVaultRoot(vault.path)
	if (!root?.directoryUri.startsWith("content://")) return
	await useVaultStore.getState().refreshFiles()
}

export function startExternalVaultRefresh(): () => void {
	if (Platform.OS !== "android") return () => {}
	let previous = AppState.currentState
	const subscription = AppState.addEventListener("change", (state) => {
		const resumed = state === "active" && previous !== "active"
		previous = state
		if (resumed) void refreshIfProviderBacked().catch(() => undefined)
	})
	return () => subscription.remove()
}
