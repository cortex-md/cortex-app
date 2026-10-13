import { promises as fs, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import type { VaultRegistryEntry } from "@cortex/platform"
import { getVaultFilePath, VAULT_FILES } from "@cortex/platform/utils"
import {
	parseVaultRegistry,
	patchRegistryEntry,
	removeRegistryEntry,
	serializeVaultMetadata,
	upsertRegistryEntry,
} from "@cortex/platform/vault"
import type { MainApi } from "../contract"
import { vaultsRegistryPath } from "../paths"
import { assertAllowedPath } from "../security"

let cache: VaultRegistryEntry[] | null = null
const registryChangedListeners = new Set<() => void>()

export function addRegistryChangedListener(listener: () => void): () => void {
	registryChangedListeners.add(listener)
	return () => registryChangedListeners.delete(listener)
}

function readEntries(): VaultRegistryEntry[] {
	if (cache) return cache
	try {
		cache = parseVaultRegistry(readFileSync(vaultsRegistryPath(), "utf8"))
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			console.error("[registry] ignoring unreadable vault registry:", error)
		}
		cache = []
	}
	return cache
}

function writeEntries(entries: VaultRegistryEntry[]): void {
	cache = entries
	const path = vaultsRegistryPath()
	mkdirSync(dirname(path), { recursive: true })
	writeFileSync(`${path}.tmp`, JSON.stringify(entries, null, 2), "utf8")
	renameSync(`${path}.tmp`, path)
	for (const listener of registryChangedListeners) listener()
}

async function writeVaultMetadataName(vaultPath: string, name: string, nowMs: number) {
	const metadataPath = getVaultFilePath(vaultPath, VAULT_FILES.vaultMetadata)
	const existing = await fs.readFile(metadataPath, "utf8").catch(() => null)
	const next = serializeVaultMetadata(name, existing, nowMs)
	if (next === existing) return
	await fs.mkdir(dirname(metadataPath), { recursive: true })
	await fs.writeFile(metadataPath, next, "utf8")
}

export function readVaultRegistry(): VaultRegistryEntry[] {
	return readEntries()
}

export function listRegisteredVaultPaths(): string[] {
	return readEntries().map((entry) => entry.path)
}

export const vaultRegistryApi = {
	readVaultRegistry: async () => readEntries(),
	updateVaultRegistry: async (uuid, path, name, icon) => {
		const vaultPath = assertAllowedPath(path)
		const now = Date.now()
		writeEntries(upsertRegistryEntry(readEntries(), { uuid, path, name, icon }, now))
		await writeVaultMetadataName(vaultPath, name, now)
	},
	removeFromVaultRegistry: async (uuid) => {
		writeEntries(removeRegistryEntry(readEntries(), uuid))
	},
	patchVaultRegistry: async (uuid, patch) => {
		const nextPatch =
			patch.path === undefined ? patch : { ...patch, path: assertAllowedPath(patch.path) }
		writeEntries(patchRegistryEntry(readEntries(), uuid, nextPatch))
	},
} satisfies Pick<
	Required<MainApi["vault"]>,
	"readVaultRegistry" | "updateVaultRegistry" | "removeFromVaultRegistry" | "patchVaultRegistry"
>
