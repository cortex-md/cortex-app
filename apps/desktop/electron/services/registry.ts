import { promises as fs, readFileSync } from "node:fs"
import { dirname } from "node:path"
import type { VaultRegistryEntry } from "@cortex/platform"
import {
	parseVaultRegistry,
	patchRegistryEntry,
	removeRegistryEntry,
	upsertRegistryEntry,
} from "@cortex/platform/vault"
import writeFileAtomic from "write-file-atomic"
import type { MainApi } from "../contract"
import { vaultsRegistryPath } from "../paths"
import { assertAllowedPath } from "../security"
import { writeVaultFileName } from "./vaultFile"

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

let pendingWrite: Promise<void> = Promise.resolve()

function writeEntries(entries: VaultRegistryEntry[]): Promise<void> {
	cache = entries
	for (const listener of registryChangedListeners) listener()
	const path = vaultsRegistryPath()
	const write = pendingWrite.then(async () => {
		if (cache !== entries) return
		await fs.mkdir(dirname(path), { recursive: true })
		await writeFileAtomic(path, JSON.stringify(entries, null, 2), "utf8")
	})
	pendingWrite = write.catch((error) => {
		console.error("[registry] failed to write vault registry:", error)
	})
	return write
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
		await Promise.all([
			writeEntries(upsertRegistryEntry(readEntries(), { uuid, path, name, icon }, now)),
			writeVaultFileName(vaultPath, name),
		])
	},
	removeFromVaultRegistry: async (uuid) => {
		await writeEntries(removeRegistryEntry(readEntries(), uuid))
	},
	patchVaultRegistry: async (uuid, patch) => {
		const nextPatch =
			patch.path === undefined ? patch : { ...patch, path: assertAllowedPath(patch.path) }
		await writeEntries(patchRegistryEntry(readEntries(), uuid, nextPatch))
	},
} satisfies Pick<
	Required<MainApi["vault"]>,
	"readVaultRegistry" | "updateVaultRegistry" | "removeFromVaultRegistry" | "patchVaultRegistry"
>
