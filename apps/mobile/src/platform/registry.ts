import type { Platform, VaultRegistryEntry } from "@cortex/platform"
import { getVaultFilePath, VAULT_FILES } from "@cortex/platform/utils"
import {
	parseVaultFile,
	parseVaultRegistry,
	patchRegistryEntry,
	removeRegistryEntry,
	renameVaultFile,
	serializeVaultFile,
	upsertRegistryEntry,
} from "@cortex/platform/vault"

import {
	assertSupportedPath,
	getVaultRegistryPath,
	readAppStorageText,
	writeAppStorageJson,
} from "./appStorage"
import { readOptionalTextFile, writeTextFile } from "./fs"
import { getMobileVaultPathParts } from "./mobile-vault-paths"
import {
	adoptLegacyDocumentPath,
	getLegacyDocumentPath,
	getRootFolderName,
	type MobileVaultRootRecord,
	readMobileVaultRoots,
} from "./vaultRoots"

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

let registryMigration: Promise<void> | null = null

async function readStoredRegistry(): Promise<VaultRegistryEntry[]> {
	const registryJson = await readAppStorageText(getVaultRegistryPath())
	try {
		return registryJson ? parseVaultRegistry(registryJson) : []
	} catch (error) {
		console.error("[Cortex Mobile] ignoring unreadable vault registry", error)
		return []
	}
}

function findRoot(
	roots: readonly MobileVaultRootRecord[],
	entry: Pick<VaultRegistryEntry, "uuid" | "path">,
): MobileVaultRootRecord | undefined {
	return (
		roots.find((record) => record.logicalPath === entry.path) ??
		roots.find((record) => record.uuid === entry.uuid)
	)
}

async function adoptLegacyPath(entry: VaultRegistryEntry): Promise<VaultRegistryEntry> {
	if (!entry.path.startsWith("file://")) return entry
	const documentPath = getLegacyDocumentPath(entry.path)
	if (!documentPath) return entry
	const logicalPath = await adoptLegacyDocumentPath(documentPath).catch(() => null)
	return logicalPath ? { ...entry, path: logicalPath } : entry
}

function isUuidName(entry: VaultRegistryEntry): boolean {
	const name = entry.name.trim()
	const parts = getMobileVaultPathParts(entry.path)
	return uuidPattern.test(name) && (parts?.rootId === name || entry.uuid === name)
}

async function migrateEntry(
	entry: VaultRegistryEntry,
	roots: () => Promise<MobileVaultRootRecord[]>,
): Promise<VaultRegistryEntry> {
	const adopted = await adoptLegacyPath(entry)
	if (!isUuidName(adopted)) return adopted
	const root = findRoot(await roots(), adopted)
	return { ...adopted, name: root ? getRootFolderName(root) : "Vault" }
}

async function migrateRegistry(): Promise<void> {
	const entries = await readStoredRegistry()
	if (entries.length === 0) return
	const migrated = await Promise.all(
		entries.map((entry) => migrateEntry(entry, readMobileVaultRoots)),
	)
	const changed = migrated.some(
		(entry, index) => entry.path !== entries[index]?.path || entry.name !== entries[index]?.name,
	)
	if (changed) await writeAppStorageJson(getVaultRegistryPath(), migrated)
}

function ensureRegistryMigrated(): Promise<void> {
	registryMigration ??= migrateRegistry().catch((error: unknown) => {
		console.error("[Cortex Mobile] vault registry migration failed", error)
	})
	return registryMigration
}

async function readVaultRegistry(): Promise<VaultRegistryEntry[]> {
	await ensureRegistryMigrated()
	const [entries, roots] = await Promise.all([readStoredRegistry(), readMobileVaultRoots()])

	return entries.map((entry) => {
		const root = findRoot(roots, entry)
		return {
			...entry,
			displayPath: root ? getRootFolderName(root) : null,
			path: root?.logicalPath ?? entry.path,
		}
	})
}

export const vaultRegistryApi = {
	readVaultRegistry,
	updateVaultRegistry: async (uuid, path, name, icon) => {
		const supportedPath = assertSupportedPath(path, "vault.updateVaultRegistry")
		const [entries, roots] = await Promise.all([readVaultRegistry(), readMobileVaultRoots()])
		const root = findRoot(roots, { path: supportedPath, uuid })
		const now = Date.now()
		const displayPath = root ? getRootFolderName(root) : null
		const vaultPath = root?.logicalPath ?? supportedPath

		await writeAppStorageJson(
			getVaultRegistryPath(),
			upsertRegistryEntry(entries, { displayPath, icon, name, path: vaultPath, uuid }, now),
		)

		const vaultFilePath = getVaultFilePath(vaultPath, VAULT_FILES.vault)
		const vaultFile = parseVaultFile(await readOptionalTextFile(vaultFilePath))
		const nextVaultFile = vaultFile && renameVaultFile(vaultFile, name)
		if (nextVaultFile) await writeTextFile(vaultFilePath, serializeVaultFile(nextVaultFile))
	},
	patchVaultRegistry: async (uuid, patch) => {
		const path =
			patch.path === undefined
				? undefined
				: assertSupportedPath(patch.path, "vault.patchVaultRegistry")
		await writeAppStorageJson(
			getVaultRegistryPath(),
			patchRegistryEntry(await readVaultRegistry(), uuid, { ...patch, path }),
		)
	},
	removeFromVaultRegistry: async (uuid) => {
		await writeAppStorageJson(
			getVaultRegistryPath(),
			removeRegistryEntry(await readVaultRegistry(), uuid),
		)
	},
} satisfies Pick<
	Platform["vault"],
	"readVaultRegistry" | "updateVaultRegistry" | "patchVaultRegistry" | "removeFromVaultRegistry"
>
