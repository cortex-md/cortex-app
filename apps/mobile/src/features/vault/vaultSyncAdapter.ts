import {
	createVaultFolder,
	formatVaultPath,
	getDefaultVaultLocation,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import type { RemoteVaultInfo, VaultRegistryEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { Directory, Paths } from "expo-file-system"
import { useEffect, useState } from "react"
import { Platform } from "react-native"

import {
	FIXTURE_CLOUD_REMOTE_VAULTS,
	FIXTURE_DOWNLOAD_PROGRESS,
	FIXTURE_SELF_HOSTED_REMOTE_VAULTS,
	FIXTURE_SELF_HOSTED_SERVER,
} from "@/features/vault/vaultFixtures"

export type RemoteServerKind = "cloud" | "selfHosted"

const DEFAULT_LOCATION_LABEL = Platform.OS === "ios" ? "On My iPhone › Cortex" : "Documents › Cortex"
const PROGRESS_TICK_MS = 1200
const PROGRESS_STEP = 0.04

function isUnsupported(error: unknown): boolean {
	return error instanceof Error && /not available in Cortex Mobile/u.test(error.message)
}

export function useRemoteVaultChoices(server: RemoteServerKind): RemoteVaultInfo[] {
	// stub: the fixture account vaults stand in until the account has remote vaults on this server
	const remoteVaults = useRemoteVaultStore((state) => state.remoteVaults)
	const selfHosted = useRemoteVaultStore((state) => state.syncConfig.selfHosted)
	const storeMatches = (server === "selfHosted") === selfHosted
	if (storeMatches && remoteVaults.length > 0) return remoteVaults
	return server === "cloud" ? FIXTURE_CLOUD_REMOTE_VAULTS : FIXTURE_SELF_HOSTED_REMOTE_VAULTS
}

export function getSelfHostedServerLabel(): string {
	// stub: the self-hosted host name comes from the fixture until the server switcher is wired
	const { serverUrl, selfHosted } = useRemoteVaultStore.getState().syncConfig
	if (selfHosted && serverUrl) return serverUrl.replace(/^https?:\/\//u, "")
	return FIXTURE_SELF_HOSTED_SERVER
}

export async function protectRemoteVault(remoteVaultId: string, password: string): Promise<void> {
	// stub: the E2E key setup is not available on mobile; the password is accepted locally
	if (password.length < 8) throw new Error("Password must be at least 8 characters")
	try {
		await useSyncStore.getState().createVaultKey(remoteVaultId)
	} catch (error) {
		if (!isUnsupported(error)) throw error
	}
}

export async function unlockRemoteVault(remoteVaultId: string, password: string): Promise<void> {
	// stub: key unlock is not available on mobile; a non-empty password is accepted
	if (!password) throw new Error("Enter the password")
	try {
		await useSyncStore.getState().unlockVaultKey(remoteVaultId, password)
	} catch (error) {
		if (!isUnsupported(error)) throw error
	}
}

export function useDownloadProgress(active: boolean): number {
	// stub: the remote download runs in the sync engine; progress is simulated from the fixture
	const [progress, setProgress] = useState(FIXTURE_DOWNLOAD_PROGRESS)
	useEffect(() => {
		if (!active) return
		const timer = setInterval(() => {
			setProgress((value) => Math.min(1, value + PROGRESS_STEP))
		}, PROGRESS_TICK_MS)
		return () => clearInterval(timer)
	}, [active])
	return progress
}

export async function createLocalVaultFolder(
	parentPath: string | null,
	name: string,
): Promise<string> {
	// stub: the platform has no createVaultFolder yet; the folder is created in app storage
	try {
		return await createVaultFolder(parentPath, name)
	} catch {
		const parent = parentPath ? new Directory(parentPath) : new Directory(Paths.document, "Cortex")
		if (!parent.exists) parent.create({ intermediates: true })
		const folder = new Directory(parent, name)
		if (!folder.exists) folder.create()
		return folder.uri
	}
}

export async function getDefaultLocationLabel(): Promise<string> {
	// stub: shows the app-storage location when the platform has no default vault location
	const location = await getDefaultVaultLocation()
	return location ? formatVaultPath(location) : DEFAULT_LOCATION_LABEL
}

export async function locateVaultFolder(entry: VaultRegistryEntry): Promise<boolean> {
	// stub: patchVaultRegistry is missing on mobile, so the registry entry is re-registered at the picked path
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

export async function showVaultInFiles(entry: VaultRegistryEntry): Promise<void> {
	// stub: revealing a folder in the system Files app is not available on mobile yet
	try {
		await getPlatform().dialog.revealFolder(entry.path)
	} catch (error) {
		if (!isUnsupported(error)) throw error
	}
}
