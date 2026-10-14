import { Platform } from "react-native"

import type { MenuGroup } from "@/components/ui/menuTypes"
import type { SymbolName } from "@/components/ui/Symbol"

export interface NoteMenuHandlers {
	bookmarked: boolean
	excluded: boolean
	pluginItems: { key: string; label: string; onPress?: () => void }[]
	onFind: () => void
	onAddProperty?: () => void
	onToggleBookmark: () => void
	onShare: () => void
	onComments: () => void
	onOutline: () => void
	onMakeCopy: () => void
	onRename: () => void
	onExport: () => void
	onCopyPath: () => void
	onVersionHistory: () => void
	onSyncStatus: () => void
	onToggleExcluded: () => void
	onDelete: () => void
}

export function buildNoteMenuGroups(handlers: NoteMenuHandlers): MenuGroup[] {
	const groups: MenuGroup[] = [
		[
			{
				key: "find",
				label: "Find in note",
				icon: { sf: "magnifyingglass", md: "search" },
				onPress: handlers.onFind,
			},
			{
				key: "bookmark",
				label: handlers.bookmarked ? "Remove bookmark" : "Add bookmark",
				icon: handlers.bookmarked
					? { sf: "bookmark.slash", md: "bookmark_remove" }
					: { sf: "bookmark", md: "bookmark_add" },
				onPress: handlers.onToggleBookmark,
			},
			{
				key: "outline",
				label: "Outline and backlinks",
				icon: { sf: "list.bullet.indent", md: "toc" },
				onPress: handlers.onOutline,
			},
			...(handlers.onAddProperty
				? [
						{
							key: "add-property",
							label: "Add property",
							icon: { sf: "list.bullet.rectangle", md: "list_alt" } satisfies SymbolName,
							onPress: handlers.onAddProperty,
						},
					]
				: []),
		],
		[
			{
				key: "version-history",
				label: "Version history",
				icon: { sf: "clock.arrow.circlepath", md: "history" },
				onPress: handlers.onVersionHistory,
			},
			{
				key: "sync-status",
				label: "Sync status and logs",
				icon: { sf: "arrow.triangle.2.circlepath.icloud", md: "sync" },
				onPress: handlers.onSyncStatus,
			},
			{
				key: "exclude",
				label: handlers.excluded ? "Include in sync" : "Exclude from sync",
				icon: handlers.excluded
					? { sf: "icloud", md: "cloud" }
					: { sf: "icloud.slash", md: "cloud_off" },
				onPress: handlers.onToggleExcluded,
			},
		],
		[
			{
				key: "share",
				label: "Share",
				icon: { sf: "person.badge.plus", md: "person_add" },
				onPress: handlers.onShare,
			},
			{
				key: "comments",
				label: "Comments",
				icon: { sf: "text.bubble", md: "comment" },
				onPress: handlers.onComments,
			},
			{
				key: "export",
				label: "Export",
				icon: { sf: "square.and.arrow.up", md: "ios_share" },
				onPress: handlers.onExport,
			},
		],
		[
			{
				key: "rename",
				label: "Rename",
				icon: { sf: "pencil", md: "edit" },
				onPress: handlers.onRename,
			},
			{
				key: "copy",
				label: "Make a copy",
				icon: { sf: "doc.on.doc", md: "content_copy" },
				onPress: handlers.onMakeCopy,
			},
			{
				key: "copy-path",
				label: "Copy path",
				icon: { sf: "link", md: "link" },
				onPress: handlers.onCopyPath,
			},
		],
	]
	if (handlers.pluginItems.length > 0) {
		groups.push(
			handlers.pluginItems.map((item) => ({
				key: `plugin-${item.key}`,
				label: item.label,
				disabled: !item.onPress,
				icon: { sf: "puzzlepiece.extension", md: "extension" },
				onPress: () => item.onPress?.(),
			})),
		)
	}
	groups.push([
		{
			key: "delete",
			label: "Delete",
			destructive: true,
			icon: { sf: "trash", md: "delete" },
			onPress: handlers.onDelete,
		},
	])
	return groups
}

export const NOTE_MENU_LABEL = Platform.OS === "ios" ? "Note actions" : "More options"

export const NOTE_MENU_ICON: SymbolName = { sf: "ellipsis", md: "more_vert" }

export const NOTE_BOTTOM_MENU_LABEL = "Notes"

export const NOTE_BOTTOM_MENU_ICON: SymbolName = { sf: "square.and.pencil", md: "edit_square" }

export function buildNoteBottomMenuGroups({
	onFind,
	onNewNote,
	onTabs,
	tabCount,
}: {
	onFind: () => void
	onNewNote: () => void
	onTabs: () => void
	tabCount: number
}): MenuGroup[] {
	return [
		[
			{
				key: "find",
				label: "Find or create a note",
				icon: { sf: "magnifyingglass", md: "search" },
				onPress: onFind,
			},
			{
				key: "new",
				label: "New note",
				icon: { sf: "square.and.pencil", md: "note_add" },
				onPress: onNewNote,
			},
		],
		[
			{
				key: "tabs",
				label: `Open tabs (${tabCount})`,
				icon: { sf: "square.on.square", md: "tab" },
				onPress: onTabs,
			},
		],
	]
}
