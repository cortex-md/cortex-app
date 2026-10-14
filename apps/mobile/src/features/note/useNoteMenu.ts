import { executeCommand } from "@cortex/commands"
import { useBookmarksStore, useSyncStore, useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { selectVisibleStatusBarItems, usePluginStore } from "@cortex/plugin-host-core"

import type { MenuGroup } from "@/components/ui/menuTypes"
import { toast } from "@/features/feedback/useToast"
import { openVersionHistory, presentSheet } from "@/features/navigation/routes"
import type { NoteDialog } from "@/features/note/NoteDialogs"
import { buildNoteMenuGroups } from "@/features/note/noteMenu"

export function useNoteMenu({
	filePath,
	onAddProperty,
	onDialog,
	onFind,
	onRename,
	relativePath,
	title,
}: {
	filePath: string | null
	onAddProperty?: () => void
	onDialog: (dialog: NoteDialog) => void
	onFind: () => void
	onRename: () => void
	relativePath: string
	title: string
}): MenuGroup[] {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const bookmarked = useBookmarksStore((state) =>
		filePath ? Boolean(state.bookmarkedPaths[filePath]) : false,
	)
	const toggleBookmark = useBookmarksStore((state) => state.toggleBookmark)
	const excluded = useSyncStore((state) =>
		state.syncPreferences.excludedPaths.includes(relativePath),
	)
	const toggleExcludedPath = useSyncStore((state) => state.toggleExcludedPath)
	const statusBarItems = usePluginStore((state) => state.statusBarItems)
	const settingsValues = usePluginStore((state) => state.settingsValues)
	const sheetParams = filePath ? { filePath } : undefined

	return buildNoteMenuGroups({
		bookmarked,
		excluded,
		pluginItems: selectVisibleStatusBarItems({ settingsValues, statusBarItems }).map((item) => ({
			key: item.key,
			label: item.text ?? item.tooltip ?? item.id,
			onPress: item.onClick,
		})),
		onAddProperty,
		onFind,
		onToggleBookmark: () => {
			if (!vaultPath || !filePath) return
			void toggleBookmark(vaultPath, filePath).then((result) =>
				toast(result.bookmarked ? "Added bookmark" : "Removed bookmark"),
			)
		},
		onShare: () => presentSheet("people", sheetParams),
		onComments: () => presentSheet("comments", sheetParams),
		onOutline: () => presentSheet("outline", sheetParams),
		onMakeCopy: () => {
			if (!filePath) return
			executeCommand("file.duplicate", { payload: { filePath }, source: "menu" })
			toast(`Made a copy of ${title}`)
		},
		onRename,
		onExport: () => presentSheet("export", sheetParams),
		onCopyPath: () => {
			void getPlatform()
				.clipboard.writeText(relativePath || filePath || "")
				.then(() => toast("Copied path"))
		},
		onVersionHistory: () => openVersionHistory(filePath ?? undefined),
		onToggleExcluded: () => {
			if (!relativePath) return
			void toggleExcludedPath(relativePath, !excluded).then(() =>
				toast(excluded ? "Included in sync" : "Excluded from sync"),
			)
		},
		onDelete: () => onDialog("delete"),
	})
}
