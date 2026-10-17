import {
	createFileTreeViewModelFromTree,
	useVaultFileTree,
	useVaultFolderPaths,
	useVaultStore,
} from "@cortex/core"
import { useMemo } from "react"

import { useEntryMenuGroups } from "@/features/file-explorer/useEntryMenuGroups"
import { openNote } from "@/features/navigation/routes"
import type { SidebarUi } from "@/features/sidebar/sidebarUiState"
import { triggerSelectionHaptic } from "@/utils/haptics"

export function useFileExplorerActions({ closeSidebar, dispatchUi, uiState }: SidebarUi) {
	const refreshFiles = useVaultStore((state) => state.refreshFiles)
	const tree = useVaultFileTree()
	const folderPaths = useVaultFolderPaths()
	const treeView = useMemo(
		() => createFileTreeViewModelFromTree(tree, folderPaths, uiState.expandedFolders),
		[folderPaths, tree, uiState.expandedFolders],
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
