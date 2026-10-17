import { toVaultRelativePath, useVaultStore } from "@cortex/core"
import type { FolderPickerOption } from "@cortex/ui"
import { useMemo } from "react"

export function useTemplateFolderOptions(): FolderPickerOption[] {
	const files = useVaultStore((state) => state.files)
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
