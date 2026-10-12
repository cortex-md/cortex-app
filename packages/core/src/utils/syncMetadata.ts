import { getPlatform } from "@cortex/platform"
import { getVaultFilePath, VAULT_FILES } from "@cortex/platform/utils"
import type {
	SyncPluginEntry,
	SyncPluginsManifest,
	SyncThemeEntry,
	SyncThemesManifest,
} from "../types/syncMetadata"

export function generatePluginMetadata(plugins: SyncPluginEntry[]): SyncPluginsManifest {
	return { version: 1, plugins }
}

export function generateThemeMetadata(themes: SyncThemeEntry[]): SyncThemesManifest {
	return { version: 1, themes }
}

export async function writeSyncPluginMetadata(
	vaultPath: string,
	manifest: SyncPluginsManifest,
): Promise<void> {
	const platform = getPlatform()
	const filePath = getVaultFilePath(vaultPath, VAULT_FILES.syncPlugins)
	await platform.fs.writeFile(filePath, JSON.stringify(manifest, null, "\t"))
}

export async function writeSyncThemeMetadata(
	vaultPath: string,
	manifest: SyncThemesManifest,
): Promise<void> {
	const platform = getPlatform()
	const filePath = getVaultFilePath(vaultPath, VAULT_FILES.syncThemes)
	await platform.fs.writeFile(filePath, JSON.stringify(manifest, null, "\t"))
}

export async function readSyncPluginMetadata(
	vaultPath: string,
): Promise<SyncPluginsManifest | null> {
	const platform = getPlatform()
	const filePath = getVaultFilePath(vaultPath, VAULT_FILES.syncPlugins)
	try {
		const content = await platform.fs.readFile(filePath)
		return JSON.parse(content) as SyncPluginsManifest
	} catch {
		return null
	}
}

export async function readSyncThemeMetadata(vaultPath: string): Promise<SyncThemesManifest | null> {
	const platform = getPlatform()
	const filePath = getVaultFilePath(vaultPath, VAULT_FILES.syncThemes)
	try {
		const content = await platform.fs.readFile(filePath)
		return JSON.parse(content) as SyncThemesManifest
	} catch {
		return null
	}
}
