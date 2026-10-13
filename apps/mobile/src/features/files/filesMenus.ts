import { Platform } from "react-native"

import type { MenuGroup, MenuItem } from "@/components/ui/menuTypes"
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
				icon: { sf: "square.and.pencil", md: "edit_square" },
				onPress: onNewNote,
			},
			{
				key: "note-from-template",
				label: IS_IOS ? "Note from Template…" : "Note from template",
				icon: { sf: "doc.badge.plus", md: "note_add" },
				onPress: () => presentSheet("from-template"),
			},
			{
				key: "database",
				label: "Database",
				icon: { sf: "tablecells", md: "table" },
				onPress: () => presentSheet("db-new"),
			},
			{
				key: "folder",
				label: "Folder",
				icon: { sf: "folder.badge.plus", md: "create_new_folder" },
				onPress: onNewFolder,
			},
		],
		[
			{
				key: "folder-to-database",
				label: IS_IOS ? "Turn a Folder into a Database" : "Folder to database",
				icon: { sf: "arrow.down.doc", md: "move_to_inbox" },
				onPress: () => presentSheet("db-new", { source: "folder" }),
			},
			{
				key: "import",
				label: IS_IOS ? "Import…" : "Import",
				icon: { sf: "square.and.arrow.down", md: "download" },
				onPress: () => presentSheet("import"),
			},
		],
	]
}

export function buildFilesMoreMenuGroups(sortOrder: FilesSortOrder, isRoot: boolean): MenuGroup[] {
	const sortItems: MenuItem[] = (["name", "edited"] as const).map((order) => ({
		key: `sort-${order}`,
		label: filesSortLabels[order],
		checked: sortOrder === order,
		icon:
			order === "name"
				? { sf: "textformat.abc", md: "sort_by_alpha" }
				: { sf: "clock", md: "schedule" },
		onPress: () => setFilesSortOrder(order),
	}))
	const groups: MenuGroup[] = [
		sortItems,
		[
			{
				key: "command-palette",
				label: IS_IOS ? "Command Palette" : "Command palette",
				icon: { sf: "command", md: "terminal" },
				onPress: () => presentSheet("command-palette"),
			},
			{
				key: "deleted-notes",
				label: IS_IOS ? "Deleted Notes" : "Deleted notes",
				icon: { sf: "trash", md: "delete" },
				onPress: () => openSettings("deleted-notes"),
			},
		],
	]
	if (!isRoot) return groups
	return [
		[
			{
				key: "switch-vault",
				label: IS_IOS ? "Switch Vault…" : "Switch vault",
				icon: { sf: "arrow.left.arrow.right", md: "swap_horiz" },
				onPress: () => presentSheet("vault-switcher"),
			},
			{
				key: "vault-settings",
				label: IS_IOS ? "Vault Settings" : "Vault settings",
				icon: { sf: "slider.horizontal.3", md: "tune" },
				onPress: () => openSettings("vaults"),
			},
		],
		...groups,
	]
}
