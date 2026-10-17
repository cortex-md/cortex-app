import { toVaultRelativePath, useVaultFolderPaths, useVaultStore } from "@cortex/core"
import type { FileEntry } from "@cortex/platform"
import type { FolderPickerOption } from "@cortex/ui"
import { useMemo } from "react"

export function useSettingsVaultFiles(): FileEntry[] {
	return useVaultStore((state) => state.files)
}

export function useSettingsVaultFolders(): FolderPickerOption[] {
	const folderPaths = useVaultFolderPaths()
	const vaultPath = useVaultStore((state) => state.vault?.path)
	return useMemo<FolderPickerOption[]>(() => {
		if (!vaultPath) return []
		return folderPaths.flatMap((path) => {
			const relative = toVaultRelativePath(path, vaultPath) ?? path
			if (relative.split("/").some((segment) => segment.startsWith("."))) return []
			return [{ value: relative, label: `${relative}/`, isDir: true }]
		})
	}, [folderPaths, vaultPath])
}
