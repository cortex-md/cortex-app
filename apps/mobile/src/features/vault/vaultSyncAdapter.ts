import {
	resolveSyncServerUrl,
	useAccountStore,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import type { RemoteVaultInfo, VaultRegistryEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { useEffect } from "react"
import { Alert } from "react-native"

export function useRemoteVaultChoices(): RemoteVaultInfo[] {
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const serverUrl = useRemoteVaultStore((state) => resolveSyncServerUrl(state.syncConfig))
	useEffect(() => {
		if (serverUrl) void useRemoteVaultStore.getState().fetchRemoteVaults()
	}, [serverUrl])
	return remoteVaults
}

function showRecoveryKey(recoveryKey: string): void {
	Alert.alert(
		"Save your recovery key",
		`${recoveryKey}\n\nStore it somewhere safe. It is the only way back into your encrypted notes if you forget your password.`,
		[
			{ onPress: () => void getPlatform().clipboard.writeText(recoveryKey), text: "Copy" },
			{ style: "cancel", text: "I saved it" },
		],
	)
}

async function ensureAccountKeys(password: string): Promise<void> {
	const account = useAccountStore.getState()
	const status = await account.loadKeyStatus()
	if (!status || (status.kdfVersion !== 0 && status.hasLocalIdentity)) return
	const result = await account.setupKeys(password)
	if (result.recoveryKey) showRecoveryKey(result.recoveryKey)
}

export async function protectRemoteVault(remoteVaultId: string, password: string): Promise<void> {
	await ensureAccountKeys(password)
	await useSyncStore.getState().createVaultKey(remoteVaultId)
}

export async function unlockRemoteVault(remoteVaultId: string, password: string): Promise<void> {
	await ensureAccountKeys(password)
	const sync = useSyncStore.getState()
	const status = await sync.checkVaultEncryption(remoteVaultId)
	if (status.hasLocalKey) return
	if (!status.hasKey) {
		await sync.createVaultKey(remoteVaultId)
		return
	}
	if ((await sync.requestVaultKey(remoteVaultId)) === "granted") return
	if (status.hasPasswordKey) await sync.unlockVaultKey(remoteVaultId, password)
}

export function useDownloadProgress(active: boolean): number {
	const progress = useSyncStore((state) => state.initialSyncProgress)
	const complete = useSyncStore((state) => state.initialSyncComplete)
	if (!active) return 0
	if (complete) return 1
	if (!progress || progress.total === 0) return 0
	return Math.min(1, progress.completed / progress.total)
}

export async function locateVaultFolder(entry: VaultRegistryEntry): Promise<boolean> {
	const path = await getPlatform().dialog.pickFolder({ title: `Locate ${entry.name}` })
	if (!path) return false
	const vault = getPlatform().vault
	if (vault.patchVaultRegistry) {
		await vault.patchVaultRegistry(entry.uuid, { path })
	} else {
		await vault.updateVaultRegistry(entry.uuid, path, entry.name, entry.icon)
	}
	await useVaultStore.getState().loadRecentVaults()
	return true
}
