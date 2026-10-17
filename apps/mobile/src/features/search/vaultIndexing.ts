import {
	type NoteMetadataUpdate,
	noteMetadataIndex,
	subscribeVaultIndexChanges,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { getContentFingerprint, isMarkdownPath } from "@cortex/platform/utils"
import { useSearchStore } from "@cortex/search"
import { useEffect, useSyncExternalStore } from "react"

const READ_BATCH_SIZE = 200

let indexedVaultPath: string | null = null
let pending: Promise<void> | null = null
const pendingIndexPaths = new Set<string>()
const pendingRemovePaths = new Set<string>()
const listeners = new Set<() => void>()

function notify(): void {
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getIndexedVaultPath(): string | null {
	return indexedVaultPath
}

subscribeVaultIndexChanges((delta) => {
	if (!indexedVaultPath || useVaultStore.getState().vault?.path !== indexedVaultPath) return
	for (const entry of delta.removed) {
		if (entry.isDir || !isMarkdownPath(entry.path)) continue
		pendingIndexPaths.delete(entry.path)
		pendingRemovePaths.add(entry.path)
	}
	for (const entry of [...delta.added, ...delta.modified]) {
		if (entry.isDir || !isMarkdownPath(entry.path)) continue
		pendingRemovePaths.delete(entry.path)
		pendingIndexPaths.add(entry.path)
	}
	if (pendingIndexPaths.size > 0 || pendingRemovePaths.size > 0) void ensureVaultIndexed()
})

async function applyPendingChanges(vaultPath: string): Promise<void> {
	const removed = [...pendingRemovePaths]
	const added = [...pendingIndexPaths]
	pendingRemovePaths.clear()
	pendingIndexPaths.clear()
	const search = useSearchStore.getState()
	for (const path of removed) {
		void search.removeFile(vaultPath, path)
		noteMetadataIndex.remove(path)
	}
	for (let start = 0; start < added.length; start += READ_BATCH_SIZE) {
		const batch = added.slice(start, start + READ_BATCH_SIZE)
		const reads = await getPlatform().fs.readTextFiles(batch)
		if (useVaultStore.getState().vault?.path !== vaultPath) return
		const updates: NoteMetadataUpdate[] = []
		reads.forEach((read, index) => {
			const path = batch[index]
			if (!read || !path) return
			void search.indexFile(vaultPath, path, {
				content: read.content,
				modifiedAt: read.modifiedAt,
			})
			updates.push({
				path,
				content: read.content,
				fingerprint: getContentFingerprint(read.content, read.modifiedAt),
			})
		})
		noteMetadataIndex.updateMany(updates)
	}
}

export function ensureVaultIndexed(): Promise<void> {
	const { vault, files } = useVaultStore.getState()
	if (!vault) return Promise.resolve()
	if (pending) return pending
	const isIndexed = indexedVaultPath === vault.path
	if (isIndexed && pendingIndexPaths.size === 0 && pendingRemovePaths.size === 0) {
		return Promise.resolve()
	}
	const run = async () => {
		if (isIndexed) {
			await applyPendingChanges(vault.path)
			return
		}
		pendingIndexPaths.clear()
		pendingRemovePaths.clear()
		await useSearchStore.getState().indexVault(vault.path, files)
		if (useVaultStore.getState().vault !== vault) return
		await noteMetadataIndex.build(vault.path, files)
		indexedVaultPath = vault.path
		notify()
	}
	pending = run().finally(() => {
		pending = null
		const current = useVaultStore.getState().vault
		if (!current) return
		if (current.path !== vault.path || pendingIndexPaths.size > 0 || pendingRemovePaths.size > 0) {
			void ensureVaultIndexed()
		}
	})
	return pending
}

export function useEnsureVaultIndexed(): boolean {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const readyVaultPath = useSyncExternalStore(subscribe, getIndexedVaultPath, getIndexedVaultPath)
	useEffect(() => {
		if (!vaultPath) return
		void ensureVaultIndexed()
	}, [vaultPath])
	return vaultPath !== null && readyVaultPath === vaultPath
}
