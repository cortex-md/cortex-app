import { canReadVaultPath, canWriteVaultPath, useAccessStore } from "./accessStore"
import { useVaultStore } from "./vaultStore"

export function useCanReadVaultPath(absolutePath: string | null, isDirectory = false): boolean {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	return useAccessStore((state) =>
		absolutePath ? canReadVaultPath(absolutePath, isDirectory, state.evaluator, vaultPath) : true,
	)
}

export function useCanWriteVaultPath(absolutePath: string | null, isDirectory = false): boolean {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	return useAccessStore((state) =>
		absolutePath ? canWriteVaultPath(absolutePath, isDirectory, state.evaluator, vaultPath) : true,
	)
}
