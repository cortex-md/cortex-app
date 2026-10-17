import type { FileEntry } from "@cortex/platform"
import { getVaultIndex, useVaultStore } from "../stores/vaultStore"
import type { FileTreeNode } from "../utils/fileTree"
import type { VaultIndex } from "./vaultIndex"

type VaultEntryLookup = (path: string) => FileEntry | undefined

let entryLookup: { index: VaultIndex; version: number; lookup: VaultEntryLookup } | null = null

function getVaultEntryLookup(): VaultEntryLookup {
	const index = getVaultIndex()
	if (entryLookup?.index !== index || entryLookup.version !== index.treeVersion) {
		entryLookup = { index, version: index.treeVersion, lookup: (path) => index.get(path) }
	}
	return entryLookup.lookup
}

export function useVaultEntryLookup(): VaultEntryLookup {
	return useVaultStore(getVaultEntryLookup)
}

export function useVaultFileTree(): readonly FileTreeNode[] {
	return useVaultStore(() => getVaultIndex().getRoots())
}

export function useVaultEntry(path: string | null | undefined): FileEntry | undefined {
	return useVaultStore(() => (path ? getVaultIndex().get(path) : undefined))
}

export function useFolderEntries(folderPath: string): readonly FileEntry[] {
	return useVaultStore(() => getVaultIndex().getChildEntries(folderPath))
}

export function useVaultFolderPaths(): readonly string[] {
	return useVaultStore(() => getVaultIndex().getFolderPaths())
}

export function useVaultModifiedTimes(): ReadonlyMap<string, number> {
	return useVaultStore(() => getVaultIndex().getModifiedTimes())
}

export function useVaultModifiedTime(path: string | null | undefined): number | null {
	return useVaultStore(() => (path ? getVaultIndex().getModifiedTime(path) : null))
}
