import { useUIStore, useVaultStore } from "@cortex/core"
import { useHotkeysStore } from "@cortex/hotkeys"
import { getPlatform, type OpenSettingsWindowOptions } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { emit, listen } from "@tauri-apps/api/event"
import { useCallback, useEffect, useState } from "react"
import { useAppCommands } from "../../hooks/useAppCommands"
import { AuthModal } from "../auth/AuthModal"
import type {
	MarketplaceOpenRequest,
	OpenMarketplaceHandler,
} from "../marketplace/openMarketplaceView"
import { SettingsContent } from "./SettingsModal"

function readRoute(): OpenSettingsWindowOptions {
	const params = new URLSearchParams(window.location.search)
	return {
		section: params.get("section"),
		vaultPath: params.get("vaultPath"),
		vaultName: params.get("vaultName"),
	}
}

export function SettingsWindow() {
	const [route, setRoute] = useState<OpenSettingsWindowOptions>(() => readRoute())
	const loadVaultSnapshot = useVaultStore((s) => s.loadVaultSnapshot)
	const loadSettings = useSettingsStore((s) => s.loadSettings)
	const loadGlobalSettings = useSettingsStore((s) => s.loadGlobalSettings)
	const nativeWindowEffects = useSettingsStore((s) => s.settings.appearance.nativeWindowEffects)
	const loadOverrides = useHotkeysStore((s) => s.loadOverrides)
	const closeSettings = useUIStore((s) => s.closeSettings)
	useAppCommands()

	const handleOpenMarketplace = useCallback<OpenMarketplaceHandler>(async (tab, options) => {
		await emit<MarketplaceOpenRequest>("marketplace-open", {
			tab,
			...(options?.selectedEntryId ? { selectedEntryId: options.selectedEntryId } : {}),
		})
		const platform = getPlatform()
		await Promise.all([platform.window.focusMain(), platform.window.closeCurrent()])
	}, [])

	useEffect(() => {
		closeSettings()
	}, [closeSettings])

	useEffect(() => {
		void loadGlobalSettings()
	}, [loadGlobalSettings])

	useEffect(() => {
		const vaultPath = route.vaultPath
		if (!vaultPath) return
		loadVaultSnapshot(vaultPath).then(() => {
			loadSettings(vaultPath)
			loadOverrides(vaultPath)
		})
	}, [route.vaultPath, loadVaultSnapshot, loadOverrides, loadSettings])

	useEffect(() => {
		const unlisten = listen<OpenSettingsWindowOptions>("settings-route", (event) => {
			setRoute((current) => ({ ...current, ...event.payload }))
		})
		return () => {
			unlisten.then((fn) => fn())
		}
	}, [])

	return (
		<div
			className="settings-window app-shell h-screen bg-bg-primary text-text-primary"
			data-native-window-effects={nativeWindowEffects ? "enabled" : "disabled"}
		>
			<SettingsContent
				fullHeight
				initialSection={route.section}
				onOpenMarketplace={handleOpenMarketplace}
			/>
			<AuthModal />
		</div>
	)
}
