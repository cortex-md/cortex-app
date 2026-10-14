import { executeCommand } from "@cortex/commands"
import { FILE_COMMAND_IDS, useBookmarksStore, useVaultStore } from "@cortex/core"
import type { Href } from "expo-router"
import { Platform, StyleSheet, View } from "react-native"

import { toast } from "@/features/feedback/useToast"
import { useEntryMenuGroups } from "@/features/file-explorer/useEntryMenuGroups"
import { DatabaseItemRows } from "@/features/files/DatabaseSection"
import { FolderRow, NoteRow } from "@/features/files/FileRow"
import type { FilesItem } from "@/features/files/useFilesScreenModel"
import { openFolder, openNote } from "@/features/navigation/routes"
import { triggerDeleteHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"

function NoteItem({ item }: { item: Extract<FilesItem, { kind: "note" }> }) {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const bookmarked = useBookmarksStore((state) => Boolean(state.bookmarkedPaths[item.entry.path]))
	const toggleBookmark = useBookmarksStore((state) => state.toggleBookmark)
	const menuGroups = useEntryMenuGroups()

	return (
		<NoteRow
			bookmarked={bookmarked}
			detail={item.detail}
			href={{ params: { filePath: item.entry.path }, pathname: "/note" } as Href}
			menuGroups={menuGroups(item.entry)}
			onBookmark={() => {
				if (!vaultPath) return
				void toggleBookmark(vaultPath, item.entry.path).then((result) =>
					toast(result.bookmarked ? "Bookmarked" : "Removed bookmark"),
				)
			}}
			onDelete={() => {
				triggerDeleteHaptic()
				executeCommand(FILE_COMMAND_IDS.delete, {
					payload: { filePath: item.entry.path },
					source: "menu",
				})
			}}
			onPress={() => openNote(item.entry.path, { reuseActive: true })}
			title={item.title}
		/>
	)
}

function FolderItem({ item }: { item: Extract<FilesItem, { kind: "folder" }> }) {
	const menuGroups = useEntryMenuGroups()
	return (
		<FolderRow
			href={{ params: { path: item.entry.path }, pathname: "/folder" } as Href}
			menuGroups={menuGroups(item.entry)}
			onPress={() => openFolder(item.entry.path)}
			title={item.title}
		/>
	)
}

export function FilesItemRow({
	expanded,
	first,
	item,
	last,
	onToggleDatabase,
}: {
	expanded: boolean
	first: boolean
	item: FilesItem
	last: boolean
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
				<FolderItem item={item} />
			) : (
				<NoteItem item={item} />
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
