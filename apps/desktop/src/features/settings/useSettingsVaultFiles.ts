import { toVaultRelativePath, useVaultStore } from "@cortex/core"
import type { FileEntry } from "@cortex/platform"
import type { FolderPickerOption } from "@cortex/ui"
import { useEffect, useMemo } from "react"

export function useSettingsVaultFiles(): FileEntry[] {
	const files = useVaultStore((state) => state.files)
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const refreshFiles = useVaultStore((state) => state.refreshFiles)
	useEffect(() => {
		if (!vaultPath) return
		const refresh = () => void refreshFiles()
		refresh()
		window.addEventListener("focus", refresh)
		return () => window.removeEventListener("focus", refresh)
	}, [refreshFiles, vaultPath])
	return files
}

export function useSettingsVaultFolders(): FolderPickerOption[] {
	const files = useSettingsVaultFiles()
	const vaultPath = useVaultStore((state) => state.vault?.path)
	return useMemo<FolderPickerOption[]>(() => {
		if (!vaultPath) return []
		return files.flatMap((file) => {
			if (!file.isDir || file.name.startsWith(".")) return []
			const relative = toVaultRelativePath(file.path, vaultPath) ?? file.path
			return [{ value: relative, label: `${relative}/`, isDir: true }]
		})
	}, [files, vaultPath])
}
