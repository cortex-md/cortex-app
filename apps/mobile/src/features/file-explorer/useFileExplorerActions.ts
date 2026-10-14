import { createFileTreeViewModel, useDatabaseStore, useVaultStore } from "@cortex/core"
import { useMemo } from "react"

import { useEntryMenuGroups } from "@/features/file-explorer/useEntryMenuGroups"
import { openNote } from "@/features/navigation/routes"
import type { SidebarUi } from "@/features/sidebar/sidebarUiState"
import { triggerSelectionHaptic } from "@/utils/haptics"

export function useFileExplorerActions({ closeSidebar, dispatchUi, uiState }: SidebarUi) {
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const refreshFiles = useVaultStore((state) => state.refreshFiles)
	const databases = useDatabaseStore((state) => state.databases)
	const vaultPath = vault?.path ?? null
	const treeView = useMemo(
		() =>
			createFileTreeViewModel(files, vaultPath, uiState.expandedFolders, {
				databaseFolderPaths: new Set(Object.keys(databases)),
			}),
		[databases, files, vaultPath, uiState.expandedFolders],
	)
	const entryMenuGroups = useEntryMenuGroups(closeSidebar)

	function handleOpenNote(filePath: string) {
		openNote(filePath, { reuseActive: true })
		closeSidebar()
	}

	function handleToggleFolder(folderPath: string) {
		triggerSelectionHaptic()
		dispatchUi({ path: folderPath, type: "toggle-folder" })
	}

	function handleRefresh() {
		void refreshFiles()
	}

	function handleExpandCollapseAll() {
		triggerSelectionHaptic()
		dispatchUi({
			folders: treeView.allExpanded ? new Set() : new Set(treeView.folderPaths),
			type: "set-expanded-folders",
		})
	}

	return {
		entryMenuGroups,
		handleExpandCollapseAll,
		handleOpenNote,
		handleRefresh,
		handleToggleFolder,
		treeView,
	}
}
