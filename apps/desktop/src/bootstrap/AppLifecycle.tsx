import { useHotkeyListener, useHotkeysStore } from "@cortex/commands/hotkeys"
import {
	bootstrapApp,
	consumePendingOnboardingNote,
	flushPendingWrites,
	openLastVault,
	openVaultSession,
	reportAppError,
	startAppRuntime,
	startAuthSession,
	useAppStore,
	useDragStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { loadEditorRuntime } from "@cortex/editor/runtime"
import { useSettingsStore } from "@cortex/settings"
import { useEffect } from "react"
import { useTeamTemplates } from "../features/templates/useTeamTemplates"
import { useTemplateDeepLink } from "../features/templates/useTemplateDeepLink"
import { useAppUpdateLifecycle } from "../hooks/useAppUpdates"
import { useCommunityPluginLifecycle } from "../hooks/useCommunityPluginLifecycle"
import { useCommunityThemeLifecycle } from "../hooks/useCommunityThemeLifecycle"
import { useInviteDeepLink } from "../hooks/useInviteDeepLink"
import { useLiveNoteShares } from "../hooks/useLiveNoteShares"
import { useNativeMenuEvents } from "../hooks/useNativeMenuEvents"
import { useNativeNotifications } from "../hooks/useNativeNotifications"
import { useResetPasswordDeepLink } from "../hooks/useResetPasswordDeepLink"
import { useSharedNoteDeepLink } from "../hooks/useSharedNoteDeepLink"
import { useSyncBillingDeepLink } from "../hooks/useSyncBillingDeepLink"
import { useSyncLifecycle } from "../hooks/useSyncLifecycle"
import { useVaultOverviewRefresh } from "../hooks/useVaultOverviewRefresh"
import { scheduleIdleWork } from "../utils/scheduleIdleWork"
import { useMainWindowBridge } from "../windows/useMainWindowBridge"
import { useNativeMenuState } from "../windows/useNativeMenuState"

function openStartupVault(): Promise<unknown> {
	const params = new URLSearchParams(window.location.search)
	const vaultFromUrl = params.get("vault")
	if (vaultFromUrl) return openVaultSession(vaultFromUrl)
	if (params.has("blank")) return Promise.resolve()
	return openLastVault()
}

function useAppStartup() {
	useEffect(() => {
		bootstrapApp()
			.then(openStartupVault)
			.catch((error) =>
				reportAppError({ operation: "open-startup-vault", source: "app-startup", cause: error }),
			)
	}, [])
}

function openTabInActivePane(filePath: string) {
	useWorkspaceStore.getState().openTab(filePath)
}

function useAuthSessionWatcher() {
	useEffect(() => startAuthSession(), [])
}

function reportWorkspacePersistError(error: unknown, vaultPath: string) {
	void reportAppError({
		operation: "persist-workspace",
		source: "workspace-lifecycle",
		cause: error,
		context: { vaultPath },
	})
}

function useAppRuntime() {
	useEffect(() => {
		const stopAppRuntime = startAppRuntime({
			scheduleIdleWork,
			onVaultOpened: (vault) => void useHotkeysStore.getState().loadOverrides(vault.path),
			onWorkspaceRestored: () => {
				void loadEditorRuntime()
				consumePendingOnboardingNote(openTabInActivePane)
			},
			onWorkspacePersistError: reportWorkspacePersistError,
		})
		const handleBeforeUnload = () => {
			void flushPendingWrites()
		}
		window.addEventListener("beforeunload", handleBeforeUnload)
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload)
			stopAppRuntime()
		}
	}, [])
}

function useInactiveTabSuspension(suspendInactiveTabs: () => void) {
	useEffect(() => {
		const suspensionInterval = setInterval(
			() => {
				suspendInactiveTabs()
			},
			5 * 60 * 1000,
		)

		return () => clearInterval(suspensionInterval)
	}, [suspendInactiveTabs])
}

function useGlobalDragGuards() {
	useEffect(() => {
		const preventDefaultDrag = (event: DragEvent) => {
			if (!useDragStore.getState().dragSource) return
			event.preventDefault()
			if (event.dataTransfer) event.dataTransfer.dropEffect = "move"
		}
		const preventDefaultDrop = (event: DragEvent) => {
			if (!useDragStore.getState().dragSource) return
			event.preventDefault()
			useDragStore.getState().cancelDrag()
		}
		document.addEventListener("dragover", preventDefaultDrag)
		document.addEventListener("drop", preventDefaultDrop)
		return () => {
			document.removeEventListener("dragover", preventDefaultDrag)
			document.removeEventListener("drop", preventDefaultDrop)
		}
	}, [])
}

export function AppLifecycle() {
	const vault = useVaultStore((s) => s.vault)
	const appVersion = useAppStore((s) => s.version)
	const suspendInactiveTabs = useWorkspaceStore((s) => s.suspendInactiveTabs)
	const appearanceSettings = useSettingsStore((s) => s.settings.appearance)

	useHotkeyListener()
	useSyncLifecycle()
	useSyncBillingDeepLink()
	useInviteDeepLink()
	useSharedNoteDeepLink()
	useResetPasswordDeepLink()
	useVaultOverviewRefresh()
	useLiveNoteShares()
	useTeamTemplates()
	useTemplateDeepLink()
	useNativeNotifications()
	useCommunityPluginLifecycle(vault)
	useCommunityThemeLifecycle(vault, appearanceSettings)
	useNativeMenuEvents()
	useAppUpdateLifecycle(appVersion, vault)
	useAppStartup()
	useAuthSessionWatcher()
	useAppRuntime()
	useInactiveTabSuspension(suspendInactiveTabs)
	useGlobalDragGuards()
	useMainWindowBridge()
	useNativeMenuState()

	return null
}
