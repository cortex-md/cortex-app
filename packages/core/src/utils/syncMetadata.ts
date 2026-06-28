import { getPlatform } from "@cortex/platform"
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
	const filePath = `${vaultPath}/.cortex/sync-plugins.json`
	await platform.fs.writeFile(filePath, JSON.stringify(manifest, null, "\t"))
}

export async function writeSyncThemeMetadata(
	vaultPath: string,
	manifest: SyncThemesManifest,
): Promise<void> {
	const platform = getPlatform()
	const filePath = `${vaultPath}/.cortex/sync-themes.json`
	await platform.fs.writeFile(filePath, JSON.stringify(manifest, null, "\t"))
}

export async function readSyncPluginMetadata(
	vaultPath: string,
): Promise<SyncPluginsManifest | null> {
	const platform = getPlatform()
	const filePath = `${vaultPath}/.cortex/sync-plugins.json`
	try {
		const content = await platform.fs.readFile(filePath)
		return JSON.parse(content) as SyncPluginsManifest
	} catch {
		return null
	}
}

export async function readSyncThemeMetadata(vaultPath: string): Promise<SyncThemesManifest | null> {
	const platform = getPlatform()
	const filePath = `${vaultPath}/.cortex/sync-themes.json`
	try {
		const content = await platform.fs.readFile(filePath)
		return JSON.parse(content) as SyncThemesManifest
	} catch {
		return null
	}
}
