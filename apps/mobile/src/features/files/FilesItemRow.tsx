import { useBookmarksStore, useVaultStore } from "@cortex/core"
import { Platform, StyleSheet, View } from "react-native"

import { toast } from "@/features/feedback/useToast"
import { DatabaseItemRows } from "@/features/files/DatabaseSection"
import { FolderRow, NoteRow } from "@/features/files/FileRow"
import type { FilesDialogState } from "@/features/files/FilesDialogs"
import type { FilesItem } from "@/features/files/useFilesScreenModel"
import { openFolder, openNote } from "@/features/navigation/routes"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"

function NoteItem({
	item,
	onDialog,
}: {
	item: Extract<FilesItem, { kind: "note" }>
	onDialog: (next: FilesDialogState) => void
}) {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const bookmarked = useBookmarksStore((state) => Boolean(state.bookmarkedPaths[item.entry.path]))
	const toggleBookmark = useBookmarksStore((state) => state.toggleBookmark)

	return (
		<NoteRow
			bookmarked={bookmarked}
			detail={item.detail}
			onBookmark={() => {
				if (!vaultPath) return
				void toggleBookmark(vaultPath, item.entry.path).then((result) =>
					toast(result.bookmarked ? "Bookmarked" : "Removed bookmark"),
				)
			}}
			onDelete={() => onDialog({ kind: "delete", entry: item.entry })}
			onLongPress={() => {
				triggerSelectionHaptic()
				onDialog({ kind: "actions", entry: item.entry })
			}}
			onPress={() => openNote(item.entry.path)}
			title={item.title}
		/>
	)
}

export function FilesItemRow({
	expanded,
	first,
	item,
	last,
	onDialog,
	onToggleDatabase,
}: {
	expanded: boolean
	first: boolean
	item: FilesItem
	last: boolean
	onDialog: (next: FilesDialogState) => void
	onToggleDatabase: (folderPath: string) => void
}) {
	return (
		<View
			style={[
				styles.card,
				first ? styles.cardFirst : null,
				last ? styles.cardLast : null,
				!IS_IOS && !last ? styles.cardGap : null,
			]}
		>
			{item.kind === "database" ? (
				<DatabaseItemRows
					expanded={expanded}
					item={item}
					onToggle={() => onToggleDatabase(item.entry.folderPath)}
				/>
			) : item.kind === "folder" ? (
				<FolderRow
					onLongPress={() => {
						triggerSelectionHaptic()
						onDialog({ kind: "actions", entry: item.entry })
					}}
					onPress={() => openFolder(item.entry.path)}
					title={item.title}
				/>
			) : (
				<NoteItem item={item} onDialog={onDialog} />
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	card: {
		borderCurve: "continuous",
		marginHorizontal: 16,
		overflow: "hidden",
	},
	cardFirst: {
		borderTopLeftRadius: IS_IOS ? 26 : 20,
		borderTopRightRadius: IS_IOS ? 26 : 20,
	},
	cardGap: {
		marginBottom: 2,
	},
	cardLast: {
		borderBottomLeftRadius: IS_IOS ? 26 : 20,
		borderBottomRightRadius: IS_IOS ? 26 : 20,
	},
})
