import { useTagsStore, useVaultStore } from "@cortex/core"
import type { FileEntry } from "@cortex/platform"
import { useSearchStore } from "@cortex/search"
import { useEffect, useSyncExternalStore } from "react"

let indexedFiles: FileEntry[] | null = null
let indexedVaultPath: string | null = null
let pending: Promise<void> | null = null
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

export function ensureVaultIndexed(): Promise<void> {
	const { vault, files } = useVaultStore.getState()
	if (!vault) return Promise.resolve()
	if (pending) return pending
	if (indexedVaultPath === vault.path && indexedFiles === files) return Promise.resolve()
	const run = async () => {
		await useSearchStore.getState().indexVault(vault.path, files)
		if (useVaultStore.getState().vault !== vault) return
		await useTagsStore.getState().buildIndexFromFiles(vault.path, files)
		indexedVaultPath = vault.path
		indexedFiles = files
		notify()
	}
	pending = run().finally(() => {
		pending = null
		if (useVaultStore.getState().files !== indexedFiles) void ensureVaultIndexed()
	})
	return pending
}

export function useEnsureVaultIndexed(): boolean {
	const files = useVaultStore((state) => state.files)
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const readyVaultPath = useSyncExternalStore(subscribe, getIndexedVaultPath, getIndexedVaultPath)
	useEffect(() => {
		if (!vaultPath) return
		void ensureVaultIndexed()
	}, [files, vaultPath])
	return vaultPath !== null && readyVaultPath === vaultPath
}
