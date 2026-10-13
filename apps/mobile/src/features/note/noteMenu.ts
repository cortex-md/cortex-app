import {
	Bookmark,
	BookmarkMinus,
	CloudOff,
	Copy,
	History,
	LayoutTemplate,
	Link,
	ListTree,
	MessageSquare,
	Pencil,
	Puzzle,
	Search,
	Share,
	SlidersHorizontal,
	Trash2,
	UserPlus,
} from "lucide-react-native"
import { Platform } from "react-native"

import type { MenuGroup } from "@/components/ui/menuTypes"

export interface NoteMenuHandlers {
	bookmarked: boolean
	excluded: boolean
	pluginItems: { key: string; label: string; onPress?: () => void }[]
	onFind: () => void
	onToggleBookmark: () => void
	onShare: () => void
	onComments: () => void
	onOutline: () => void
	onInsertTemplate: () => void
	onProperties: () => void
	onMakeCopy: () => void
	onRename: () => void
	onExport: () => void
	onCopyPath: () => void
	onVersionHistory: () => void
	onToggleExcluded: () => void
	onDelete: () => void
}

export function buildNoteMenuGroups(handlers: NoteMenuHandlers): MenuGroup[] {
	const groups: MenuGroup[] = [
		[
			{
				key: "find",
				label: "Find in note",
				icon: { sf: "magnifyingglass", Lucide: Search },
				onPress: handlers.onFind,
			},
			{
				key: "bookmark",
				label: handlers.bookmarked ? "Remove bookmark" : "Add bookmark",
				icon: handlers.bookmarked
					? { sf: "bookmark.slash", Lucide: BookmarkMinus }
					: { sf: "bookmark", Lucide: Bookmark },
				onPress: handlers.onToggleBookmark,
			},
		],
		[
			{
				key: "share",
				label: "Share…",
				icon: { sf: "person.badge.plus", Lucide: UserPlus },
				onPress: handlers.onShare,
			},
			{
				key: "comments",
				label: "Comments",
				icon: { sf: "text.bubble", Lucide: MessageSquare },
				onPress: handlers.onComments,
			},
			{
				key: "outline",
				label: "Outline and backlinks",
				icon: { sf: "list.bullet.indent", Lucide: ListTree },
				onPress: handlers.onOutline,
			},
		],
		[
			{
				key: "insert-template",
				label: "Insert template",
				icon: { sf: "doc.badge.plus", Lucide: LayoutTemplate },
				onPress: handlers.onInsertTemplate,
			},
			{
				key: "properties",
				label: "Properties",
				icon: { sf: "slider.horizontal.3", Lucide: SlidersHorizontal },
				onPress: handlers.onProperties,
			},
		],
		[
			{
				key: "copy",
				label: "Make a copy",
				icon: { sf: "doc.on.doc", Lucide: Copy },
				onPress: handlers.onMakeCopy,
			},
			{
				key: "rename",
				label: "Rename",
				icon: { sf: "pencil", Lucide: Pencil },
				onPress: handlers.onRename,
			},
			{
				key: "export",
				label: "Export",
				icon: { sf: "square.and.arrow.up", Lucide: Share },
				onPress: handlers.onExport,
			},
			{
				key: "copy-path",
				label: "Copy path",
				icon: { sf: "link", Lucide: Link },
				onPress: handlers.onCopyPath,
			},
		],
		[
			{
				key: "version-history",
				label: "Version history",
				icon: { sf: "clock.arrow.circlepath", Lucide: History },
				onPress: handlers.onVersionHistory,
			},
			{
				key: "exclude",
				label: handlers.excluded ? "Include in sync" : "Exclude from sync",
				icon: { sf: "icloud.slash", Lucide: CloudOff },
				onPress: handlers.onToggleExcluded,
			},
		],
	]
	if (handlers.pluginItems.length > 0) {
		groups.push(
			handlers.pluginItems.map((item) => ({
				key: `plugin-${item.key}`,
				label: item.label,
				disabled: !item.onPress,
				icon: { sf: "puzzlepiece.extension", Lucide: Puzzle },
				onPress: () => item.onPress?.(),
			})),
		)
	}
	groups.push([
		{
			key: "delete",
			label: "Delete",
			destructive: true,
			icon: { sf: "trash", Lucide: Trash2 },
			onPress: handlers.onDelete,
		},
	])
	return groups
}

export const NOTE_MENU_LABEL = Platform.OS === "ios" ? "Note actions" : "More options"
