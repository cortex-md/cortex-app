import {
	requiresCloudEntitlement,
	resolveSyncServerUrl,
	useAuthStore,
	useRemoteVaultStore,
	useSubscriptionStore,
	useSyncLogStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import { useEffect, useRef } from "react"

export function useSyncLifecycle() {
	const vault = useVaultStore((s) => s.vault)
	const authenticated = useAuthStore((s) => s.authenticated)
	const authServerUrl = useAuthStore((s) => s.serverUrl)
	const checkAuth = useAuthStore((s) => s.checkAuth)
	const linkedVaultId = useRemoteVaultStore((s) => s.linkedVaultId)
	const syncEnabled = useRemoteVaultStore((s) => s.syncConfig.enabled)
	const syncConfig = useRemoteVaultStore((s) => s.syncConfig)
	const loadLink = useRemoteVaultStore((s) => s.loadLink)
	const startSync = useSyncStore((s) => s.startSync)
	const stopSync = useSyncStore((s) => s.stopSync)
	const subscriptionBlocked = useSubscriptionStore((s) => s.block !== null)

	const syncActiveRef = useRef(false)

	useEffect(() => {
		if (!vault) {
			loadLink("")
			return
		}
		loadLink(vault.path)
	}, [vault, loadLink])

	useEffect(() => {
		const serverUrl = resolveSyncServerUrl(syncConfig)
		if (serverUrl) void checkAuth(serverUrl)
	}, [syncConfig, checkAuth])

	useEffect(() => {
		const serverUrl = resolveSyncServerUrl(syncConfig)
		const requiresEntitlement = requiresCloudEntitlement(syncConfig)
		const cloudSubscriptionBlocked = requiresEntitlement && subscriptionBlocked
		const canSync =
			authenticated &&
			authServerUrl === serverUrl &&
			syncEnabled &&
			vault !== null &&
			linkedVaultId !== null &&
			serverUrl !== "" &&
			!cloudSubscriptionBlocked

		if (canSync) {
			if (!syncActiveRef.current) {
				syncActiveRef.current = true
				useSyncLogStore.getState().log("info", "Sync lifecycle: starting sync", {
					serverUrl,
					vaultId: linkedVaultId!,
				})
				startSync(linkedVaultId!, vault!.path, serverUrl, requiresEntitlement)
			}
		} else {
			if (syncActiveRef.current) {
				syncActiveRef.current = false
				useSyncLogStore.getState().log("info", "Sync lifecycle: stopping sync")
				stopSync()
			}
		}
	}, [
		authenticated,
		authServerUrl,
		syncEnabled,
		syncConfig,
		subscriptionBlocked,
		vault,
		linkedVaultId,
		startSync,
		stopSync,
	])

	// oxlint-disable-next-line react-doctor/exhaustive-deps -- unmount cleanup must stop the latest active sync session
	useEffect(() => {
		return () => {
			if (syncActiveRef.current) {
				syncActiveRef.current = false
				stopSync()
			}
		}
	}, [stopSync])
}
