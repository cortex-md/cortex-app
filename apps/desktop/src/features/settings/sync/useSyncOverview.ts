import {
	isMarkdownPath,
	requiresCloudEntitlement,
	resolveSyncServerUrl,
	useAuthStore,
	useDevicesStore,
	useRemoteVaultStore,
	useSubscriptionStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import { useEffect, useMemo } from "react"
import type { SyncSettingsView } from "./types"

function describeServer(serverUrl: string): string {
	try {
		return new URL(serverUrl).host || "Self-hosted"
	} catch {
		return "Self-hosted"
	}
}

export function useSyncOverview(view: SyncSettingsView) {
	const authenticated = useAuthStore((state) => state.authenticated)
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const fetchRemoteVaults = useRemoteVaultStore((state) => state.fetchRemoteVaults)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const refreshSubscriptionStatus = useSubscriptionStore((state) => state.refreshStatus)
	const engineState = useSyncStore((state) => state.engineState)
	const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
	const deviceEntries = useDevicesStore((state) => state.deviceEntries)
	const devicesLoading = useDevicesStore((state) => state.loading)
	const devicesError = useDevicesStore((state) => state.error)
	const fetchDevices = useDevicesStore((state) => state.fetchDevices)

	const serverUrl = resolveSyncServerUrl(syncConfig)
	const needsEntitlement = requiresCloudEntitlement(syncConfig)
	const devicesVaultId =
		view === "overview" && authenticated && syncConfig.enabled ? linkedVaultId : null

	// oxlint-disable react-doctor/no-event-handler -- sync overview data follows auth state and the linked vault
	useEffect(() => {
		if (authenticated && syncConfig.enabled) void fetchRemoteVaults()
	}, [authenticated, fetchRemoteVaults, syncConfig.enabled])

	useEffect(() => {
		if (!authenticated || !needsEntitlement) return
		void refreshSubscriptionStatus(serverUrl).catch(() => {})
	}, [authenticated, needsEntitlement, refreshSubscriptionStatus, serverUrl])

	useEffect(() => {
		if (devicesVaultId) void fetchDevices()
	}, [devicesVaultId, fetchDevices])
	// oxlint-enable react-doctor/no-event-handler

	const linkedVault = remoteVaults.find((remoteVault) => remoteVault.id === linkedVaultId)
	const noteCount = useMemo(
		() => files.filter((file) => !file.isDir && isMarkdownPath(file.name)).length,
		[files],
	)
	const connectedDeviceCount = useMemo(
		() => deviceEntries.filter((device) => !device.revoked).length,
		[deviceEntries],
	)

	return {
		authenticated,
		connectedDeviceCount,
		devicesError,
		devicesLoading,
		engineState,
		lastSyncedAt,
		linkedVault,
		linkedVaultId,
		noteCount,
		syncConfig,
		serverLabel: syncConfig.selfHosted ? describeServer(serverUrl) : "Cortex Cloud",
		vault,
	}
}
