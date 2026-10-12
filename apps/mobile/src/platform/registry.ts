import type { Platform, VaultRegistryEntry } from "@cortex/platform"
import { getVaultFilePath, VAULT_FILES } from "@cortex/platform/utils"
import {
	parseVaultRegistry,
	removeRegistryEntry,
	serializeVaultMetadata,
	upsertRegistryEntry,
} from "@cortex/platform/vault"

import {
	assertSupportedPath,
	getVaultRegistryPath,
	isAppStoragePath,
	readAppStorageText,
	writeAppStorageJson,
} from "./appStorage"
import { readOptionalTextFile, writeTextFile } from "./fs"
import { readMobileVaultRoots } from "./vaultRoots"

async function readVaultRegistry(): Promise<VaultRegistryEntry[]> {
	const registryJson = await readAppStorageText(getVaultRegistryPath())
	let entries: VaultRegistryEntry[] = []
	try {
		entries = registryJson ? parseVaultRegistry(registryJson) : []
	} catch (error) {
		console.error("[Cortex Mobile] ignoring unreadable vault registry", error)
	}
	const roots = await readMobileVaultRoots()

	return entries.map((entry) => {
		const root = roots.find(
			(record) => record.uuid === entry.uuid || record.logicalPath === entry.path,
		)
		return {
			...entry,
			displayPath: entry.displayPath ?? root?.displayPath ?? null,
			path: root?.logicalPath ?? entry.path,
		}
	})
}

export const vaultRegistryApi = {
	readVaultRegistry,
	updateVaultRegistry: async (uuid, path, name, icon) => {
		const supportedPath = assertSupportedPath(path, "vault.updateVaultRegistry")
		const [entries, roots] = await Promise.all([readVaultRegistry(), readMobileVaultRoots()])
		const root = roots.find(
			(record) => record.uuid === uuid || record.logicalPath === supportedPath,
		)
		const now = Date.now()
		const displayPath =
			root?.displayPath ??
			(isAppStoragePath(supportedPath) ? supportedPath.replace(/^file:\/\//u, "") : null)
		const vaultPath = root?.logicalPath ?? supportedPath

		await writeAppStorageJson(
			getVaultRegistryPath(),
			upsertRegistryEntry(entries, { displayPath, icon, name, path: vaultPath, uuid }, now),
		)

		const metadataPath = getVaultFilePath(vaultPath, VAULT_FILES.vaultMetadata)
		const existingMetadata = await readOptionalTextFile(metadataPath)
		const nextMetadata = serializeVaultMetadata(name, existingMetadata, now)
		if (nextMetadata !== existingMetadata) await writeTextFile(metadataPath, nextMetadata)
	},
	removeFromVaultRegistry: async (uuid) => {
		await writeAppStorageJson(
			getVaultRegistryPath(),
			removeRegistryEntry(await readVaultRegistry(), uuid),
		)
	},
} satisfies Pick<
	Platform["vault"],
	"readVaultRegistry" | "updateVaultRegistry" | "removeFromVaultRegistry"
>
