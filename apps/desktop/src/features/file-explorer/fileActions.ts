import {
	sendCoreNotification,
	toVaultRelativePath,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"

export type FilePathKind = "relative" | "absolute"

function getVaultRelativePath(filePath: string): string {
	const vaultPath = useVaultStore.getState().vault?.path
	return vaultPath ? (toVaultRelativePath(filePath, vaultPath) ?? filePath) : filePath
}

export async function copyFilePath(filePath: string, kind: FilePathKind): Promise<void> {
	const value = kind === "relative" ? getVaultRelativePath(filePath) : filePath
	await getPlatform().clipboard.writeText(value)
	await sendCoreNotification({ title: "Path copied", body: value })
}

export function getSyncExclusionPattern(filePath: string, isDirectory: boolean): string {
	const relativePath = getVaultRelativePath(filePath)
	return isDirectory && !relativePath.endsWith("/") ? `${relativePath}/` : relativePath
}

export async function toggleSyncExclusion(filePath: string, isDirectory: boolean): Promise<void> {
	const syncStore = useSyncStore.getState()
	const pattern = getSyncExclusionPattern(filePath, isDirectory)
	await syncStore.toggleExcludedPath(
		pattern,
		!syncStore.isPathExcluded(getVaultRelativePath(filePath)),
	)
}
