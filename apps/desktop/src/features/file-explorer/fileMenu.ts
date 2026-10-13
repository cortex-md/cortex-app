import {
	canReadVaultPath,
	canWriteVaultPath,
	type FileEntryActionId,
	getFileEntryActions,
	isMarkdownPath,
	isSyncImagePath,
	shouldIgnoreSyncPath,
	toVaultRelativePath,
	useBookmarksStore,
	useDatabaseStore,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import {
	BookmarkMinusIcon,
	BookmarkPlusIcon,
	ClipboardCopyIcon,
	CloudIcon,
	CloudOffIcon,
	DownloadIcon,
	FilePlusIcon,
	FileTextIcon,
	FolderPlusIcon,
	LayoutTemplateIcon,
	PencilIcon,
	Table2Icon,
	TableIcon,
} from "lucide-react"
import {
	commandMenuItem,
	compactMenuItems,
	getPluginMenuItems,
	MENU_SEPARATOR,
	type MenuItem,
} from "@/utils/context-menu"

export interface FileMenuTarget {
	filePath: string
	isDirectory: boolean
}

export interface FileMenuOptions {
	paneId?: string
	onRename?: () => void
	onNewNote?: () => void
	onNewFolder?: () => void
}

const FILE_ENTRY_MENU_IDS: Partial<Record<FileEntryActionId, string>> = {
	duplicate: "make-copy",
	rename: "rename",
	delete: "delete",
}

function buildFileEntryMenuItems(
	target: FileMenuTarget,
): Partial<Record<FileEntryActionId, MenuItem | null>> {
	return Object.fromEntries(
		getFileEntryActions(target).flatMap((action) => {
			const id = FILE_ENTRY_MENU_IDS[action.id]
			if (!id || !action.visible) return []
			const item = commandMenuItem(action.commandId, {
				id,
				text: action.label,
				destructive: action.destructive || undefined,
				payload: action.payload,
			})
			return [[action.id, item]]
		}),
	)
}

export function isSyncLinked(): boolean {
	const { syncConfig } = useRemoteVaultStore.getState()
	return syncConfig.enabled && syncConfig.remoteVaultId !== null
}

export function buildFileMenuItems(
	{ filePath, isDirectory }: FileMenuTarget,
	options: FileMenuOptions = {},
): MenuItem[] {
	const payload = { filePath }
	const vaultPath = useVaultStore.getState().vault?.path
	const relativePath = vaultPath ? (toVaultRelativePath(filePath, vaultPath) ?? filePath) : filePath
	const isNote = !isDirectory && isMarkdownPath(filePath)
	const { syncPreferences } = useSyncStore.getState()
	const canToggleSync =
		Boolean(vaultPath) &&
		!(syncPreferences.ignoreImages && !isDirectory && isSyncImagePath(relativePath))
	const syncExcluded = shouldIgnoreSyncPath(relativePath, syncPreferences)
	const bookmarked =
		isNote && vaultPath ? useBookmarksStore.getState().isBookmarked(vaultPath, filePath) : false
	const syncLinked = isSyncLinked()
	const canShare = isNote && syncLinked
	const showVersionHistory = isNote && Boolean(vaultPath) && canReadVaultPath(filePath)
	const entryItems = buildFileEntryMenuItems({ filePath, isDirectory })
	const canCreateInside = isDirectory && canWriteVaultPath(filePath, true)
	const isDatabase = isDirectory && Boolean(useDatabaseStore.getState().databases[filePath])

	return compactMenuItems([
		canCreateInside &&
			options.onNewNote && {
				id: "new-file",
				text: "New Note",
				icon: FilePlusIcon,
				action: options.onNewNote,
			},
		canCreateInside &&
			options.onNewFolder && {
				id: "new-folder",
				text: "New Folder",
				icon: FolderPlusIcon,
				action: options.onNewFolder,
			},
		canCreateInside &&
			!isDatabase &&
			commandMenuItem("database.new", {
				id: "new-database",
				text: "New Database",
				icon: Table2Icon,
				payload,
			}),
		isDatabase &&
			commandMenuItem("database.open", {
				id: "open-database",
				text: "Open Database",
				icon: Table2Icon,
				payload,
			}),
		canCreateInside &&
			!isDatabase &&
			commandMenuItem("database.convert-folder", {
				id: "convert-database",
				text: "Turn into Database",
				payload,
			}),
		!isDirectory &&
			commandMenuItem("file.open-in-new-tab", {
				id: "open-new-tab",
				text: "Open in New Tab",
				payload,
			}),
		!isDirectory &&
			commandMenuItem("file.open-in-right-split", {
				id: "open-right-split",
				text: "Open in Right Split",
				payload: { filePath, paneId: options.paneId },
			}),
		MENU_SEPARATOR,
		entryItems.duplicate,
		isNote &&
			commandMenuItem("templates.save-note-as-template", {
				id: "save-as-template",
				text: "Save as Template…",
				icon: LayoutTemplateIcon,
				payload,
			}),
		isNote && {
			type: "submenu",
			id: "export-note",
			text: "Export",
			icon: DownloadIcon,
			items: compactMenuItems([
				commandMenuItem("export.active-html", {
					id: "export-html",
					text: "HTML",
					icon: FileTextIcon,
					payload,
				}),
				commandMenuItem("export.active-pdf", {
					id: "export-pdf",
					text: "PDF",
					icon: DownloadIcon,
					payload,
				}),
				commandMenuItem("export.active-csv", {
					id: "export-csv",
					text: "CSV",
					icon: TableIcon,
					payload,
				}),
			]),
		},
		{
			type: "submenu",
			id: "copy-path",
			text: "Copy Path",
			icon: ClipboardCopyIcon,
			items: compactMenuItems([
				commandMenuItem("file.copy-relative-path", {
					id: "copy-relative-path",
					text: "Relative Path",
					payload,
				}),
				commandMenuItem("file.copy-absolute-path", {
					id: "copy-absolute-path",
					text: "Absolute Path",
					payload,
				}),
			]),
		},
		commandMenuItem("file.reveal", { id: "reveal", text: "Reveal in Finder", payload }),
		isNote &&
			commandMenuItem("bookmarks.toggle", {
				id: bookmarked ? "remove-bookmark" : "add-bookmark",
				text: bookmarked ? "Remove Bookmark" : "Add Bookmark",
				icon: bookmarked ? BookmarkMinusIcon : BookmarkPlusIcon,
				payload,
			}),
		MENU_SEPARATOR,
		isDirectory &&
			syncLinked &&
			commandMenuItem("sync.manage-access", {
				id: "manage-access",
				text: "Manage Access…",
				payload: { filePath, isDirectory },
			}),
		canShare &&
			commandMenuItem("sync.share-note", {
				id: "share-note",
				text: "Share…",
				payload,
			}),
		showVersionHistory &&
			commandMenuItem("sync.show-version-history", {
				id: "version-history",
				text: "Version History",
				payload,
			}),
		canToggleSync &&
			commandMenuItem("sync.toggle-excluded", {
				id: syncExcluded ? "include-in-sync" : "exclude-from-sync",
				text: syncExcluded ? "Include in Sync" : "Exclude from Sync",
				icon: syncExcluded ? CloudIcon : CloudOffIcon,
				payload: { filePath, isDirectory },
			}),
		MENU_SEPARATOR,
		options.onRename
			? { id: "rename", text: "Rename", icon: PencilIcon, action: options.onRename }
			: entryItems.rename,
		isDatabase &&
			canCreateInside &&
			commandMenuItem("database.remove", {
				id: "remove-database",
				text: "Remove Database Views",
				payload,
			}),
		MENU_SEPARATOR,
		entryItems.delete,
		...getPluginMenuItems({ location: "file", filePath }),
	])
}
