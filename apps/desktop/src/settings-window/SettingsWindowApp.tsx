import { reportAppError, useUIStore, useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { Toaster } from "@cortex/ui"
import { lazy, Suspense, useCallback, useEffect, useState } from "react"
import type { OpenMarketplaceHandler } from "../features/marketplace/openMarketplaceView"
import { type SettingsNavigateHandler, SettingsView } from "../features/settings/SettingsView"
import type { SettingsRevealTarget } from "../features/settings/settingsReveal"
import { useCommunityThemeLifecycle } from "../hooks/useCommunityThemeLifecycle"
import { useHasOpened } from "../hooks/useHasOpened"
import { MIRRORED_STORES } from "../windows/mirroredStores"
import { runInMainWindow } from "../windows/runInMainWindow"
import {
	applySnapshotSlices,
	startWindowBridge,
	type WindowSnapshot,
} from "../windows/windowBridge"

const LazyAuthModal = lazy(() =>
	import("../features/auth/AuthModal").then((module) => ({ default: module.AuthModal })),
)

const openMarketplace: OpenMarketplaceHandler = (tab, options) =>
	runInMainWindow("openMarketplace", { tab, options })

let loadedVaultPath: string | null = null

async function loadVault(vault: WindowSnapshot["vault"]): Promise<void> {
	const vaultPath = vault?.path ?? null
	if (vaultPath === loadedVaultPath) return
	loadedVaultPath = vaultPath
	if (!vault) {
		useVaultStore.setState({ vault: null, files: [] })
		return
	}
	await useSettingsStore.getState().loadSettings(vault.path)
	useVaultStore.setState({ vault, files: [] })
}

function useSettingsWindowBridge(onNavigate: SettingsNavigateHandler): void {
	useEffect(() => {
		let pending = Promise.resolve()
		const bridge = startWindowBridge({
			role: "settings",
			mirrors: MIRRORED_STORES,
			onNavigate,
			onSnapshot: (snapshot) => {
				pending = pending
					.then(() =>
						bridge.pauseRelay(async () => {
							await loadVault(snapshot.vault)
							applySnapshotSlices(MIRRORED_STORES, snapshot)
						}),
					)
					.catch((error: unknown) =>
						reportAppError({ operation: "sync-settings-window", source: "settings", cause: error }),
					)
			},
		})
		void bridge
			.pauseRelay(() => useSettingsStore.getState().loadGlobalSettings())
			.then(() => bridge.requestSnapshot())
		void getPlatform().window.markReady()
		const prefetchFonts = window.requestIdleCallback(() => {
			void getPlatform()
				.font.listSystemFonts()
				.catch(() => {})
		})

		return () => {
			window.cancelIdleCallback(prefetchFonts)
			bridge.dispose()
		}
	}, [onNavigate])
}

function SettingsWindowOverlays() {
	const authOpen = useUIStore((state) => state.authOpen)
	const authMounted = useHasOpened(authOpen)
	if (!authMounted) return null
	return (
		<Suspense fallback={null}>
			<LazyAuthModal />
		</Suspense>
	)
}

export function SettingsWindowApp() {
	const [target, setTarget] = useState<SettingsRevealTarget>({
		section: "general",
		focus: false,
		nonce: 0,
	})
	const navigate = useCallback<SettingsNavigateHandler>(
		(section, fieldId, focus = false, fallbackId) => {
			setTarget((current) => ({ section, fieldId, fallbackId, focus, nonce: current.nonce + 1 }))
		},
		[],
	)
	const vault = useVaultStore((state) => state.vault)
	const appearance = useSettingsStore((state) => state.settings.appearance)
	const nativeWindowEffects = useSettingsStore(
		(state) => state.settings.appearance.nativeWindowEffects,
	)

	useSettingsWindowBridge(navigate)
	useCommunityThemeLifecycle(vault, appearance)

	return (
		<div
			className="app-shell settings-window"
			data-native-window-effects={nativeWindowEffects ? "enabled" : "disabled"}
		>
			<div className="settings-window-titlebar">Settings</div>
			<SettingsView target={target} onNavigate={navigate} onOpenMarketplace={openMarketplace} />
			<SettingsWindowOverlays />
			<Toaster />
		</div>
	)
}
