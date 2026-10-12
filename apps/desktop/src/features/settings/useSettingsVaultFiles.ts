import { useVaultStore } from "@cortex/core"
import type { FileEntry } from "@cortex/platform"
import { useEffect } from "react"

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
