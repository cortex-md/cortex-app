import {
	ArrowDownAZ,
	Clock,
	Download,
	FolderInput,
	FolderPlus,
	LayoutTemplate,
	SquareCheck,
	SquarePen,
	Table2,
	Terminal,
	Trash2,
	SlidersHorizontal,
} from "lucide-react-native"
import { Platform } from "react-native"

import type { MenuGroup, MenuItem } from "@/components/ui/menuTypes"
import { toast } from "@/features/feedback/useToast"
import { type FilesSortOrder, filesSortLabels, setFilesSortOrder } from "@/features/files/filesSort"
import { openSettings, presentSheet } from "@/features/navigation/routes"

const IS_IOS = Platform.OS === "ios"

export interface CreateMenuHandlers {
	onNewFolder: () => void
	onNewNote: () => void
}

export function buildCreateMenuGroups({ onNewFolder, onNewNote }: CreateMenuHandlers): MenuGroup[] {
	return [
		[
			{
				key: "note",
				label: "Note",
				icon: { sf: "square.and.pencil", Lucide: SquarePen },
				onPress: onNewNote,
			},
			{
				key: "note-from-template",
				label: IS_IOS ? "Note from template…" : "Note from template",
				icon: { sf: "doc.badge.plus", Lucide: LayoutTemplate },
				onPress: () => presentSheet("from-template"),
			},
			{
				key: "database",
				label: "Database",
				icon: { sf: "tablecells", Lucide: Table2 },
				onPress: () => presentSheet("db-new"),
			},
			{
				key: "folder",
				label: "Folder",
				icon: { sf: "folder.badge.plus", Lucide: FolderPlus },
				onPress: onNewFolder,
			},
		],
		[
			{
				key: "folder-to-database",
				label: IS_IOS ? "Turn a folder into a database" : "Folder to database",
				icon: { sf: "arrow.down.doc", Lucide: FolderInput },
				onPress: () => presentSheet("db-new", { source: "folder" }),
			},
			{
				key: "import",
				label: IS_IOS ? "Import…" : "Import",
				subtitle: IS_IOS ? "CSV, HTML or PDF" : undefined,
				icon: { sf: "square.and.arrow.down", Lucide: Download },
				onPress: () => presentSheet("import"),
			},
		],
	]
}

export function buildFilesMoreMenuGroups(sortOrder: FilesSortOrder): MenuGroup[] {
	const sortItems: MenuItem[] = (["name", "edited"] as const).map((order) => ({
		key: `sort-${order}`,
		label: filesSortLabels[order],
		checked: sortOrder === order,
		icon:
			order === "name"
				? { sf: "textformat.abc", Lucide: ArrowDownAZ }
				: { sf: "clock", Lucide: Clock },
		onPress: () => setFilesSortOrder(order),
	}))
	return [
		[
			{
				key: "select",
				label: "Select",
				icon: { sf: "checkmark.circle", Lucide: SquareCheck },
				onPress: () => toast("Swipe a note to bookmark or delete it"),
			},
		],
		sortItems,
		[
			{
				key: "command-palette",
				label: "Command palette",
				icon: { sf: "terminal", Lucide: Terminal },
				onPress: () => presentSheet("command-palette"),
			},
			{
				key: "import",
				label: "Import…",
				icon: { sf: "square.and.arrow.down", Lucide: Download },
				onPress: () => presentSheet("import"),
			},
		],
		[
			{
				key: "deleted-notes",
				label: "Deleted notes",
				icon: { sf: "trash", Lucide: Trash2 },
				onPress: () => openSettings("deleted-notes"),
			},
			{
				key: "vault-settings",
				label: "Vault settings",
				icon: { sf: "slider.horizontal.3", Lucide: SlidersHorizontal },
				onPress: () => openSettings("vaults"),
			},
		],
	]
}
