import type { MenuItem } from "@/utils/context-menu"

export interface NoteMenuContext {
	path: string
	bookmarked: boolean
	syncIgnored: boolean
	showVersionHistory: boolean
	canToggleSync: boolean
}

export interface NoteMenuActions {
	openInNewTab: (path: string) => void
	openInRightSplit: (path: string) => void
	duplicate: (path: string) => void
	copyRelativePath: (path: string) => void
	copyAbsolutePath: (path: string) => void
	reveal: (path: string) => void
	showVersionHistory: (path: string) => void
	toggleBookmark: (path: string) => void
	toggleSyncIgnore: (path: string, ignored: boolean) => void
	rename: (path: string) => void
	delete: (path: string) => void
}

export function buildNoteMenuItems(context: NoteMenuContext, actions: NoteMenuActions): MenuItem[] {
	const { path } = context
	const syncItems: MenuItem[] = []

	if (context.showVersionHistory) {
		syncItems.push({
			id: "version-history",
			text: "Version History",
			action: () => actions.showVersionHistory(path),
		})
	}

	if (context.canToggleSync) {
		syncItems.push({
			id: context.syncIgnored ? "include-in-sync" : "exclude-from-sync",
			text: context.syncIgnored ? "Include in Sync" : "Exclude from Sync",
			action: () => actions.toggleSyncIgnore(path, !context.syncIgnored),
		})
	}

	return [
		{
			id: "open-new-tab",
			text: "Open in New Tab",
			action: () => actions.openInNewTab(path),
		},
		{
			id: "open-right-split",
			text: "Open in Right Split",
			action: () => actions.openInRightSplit(path),
		},
		{ type: "separator" },
		{
			id: "make-copy",
			text: "Make a Copy",
			action: () => actions.duplicate(path),
		},
		{
			id: "copy-path",
			type: "submenu",
			text: "Copy Path",
			items: [
				{
					id: "copy-relative-path",
					text: "Relative Path",
					action: () => actions.copyRelativePath(path),
				},
				{
					id: "copy-absolute-path",
					text: "Absolute Path",
					action: () => actions.copyAbsolutePath(path),
				},
			],
		},
		{
			id: "reveal",
			text: "Reveal in Finder",
			action: () => actions.reveal(path),
		},
		{
			id: context.bookmarked ? "remove-bookmark" : "add-bookmark",
			text: context.bookmarked ? "Remove Bookmark" : "Add Bookmark",
			accelerator: "CmdOrCtrl+Shift+B",
			action: () => actions.toggleBookmark(path),
		},
		...(syncItems.length > 0 ? [{ type: "separator" } as MenuItem, ...syncItems] : []),
		{ type: "separator" },
		{
			id: "rename",
			text: "Rename",
			accelerator: "F2",
			action: () => actions.rename(path),
		},
		{ type: "separator" },
		{
			id: "delete",
			text: "Delete",
			destructive: true,
			action: () => actions.delete(path),
		},
	]
}

export interface FileContextMenuContext {
	path: string
	fileName: string
	isDirectory: boolean
	selectionCount: number
	isMultiSelect: boolean
}

export interface FileContextMenuActions {
	createFile: (parentPath?: string) => void
	createFolder: (parentPath?: string) => void
	openInNewTab: (path: string) => void
	openInRightSplit?: (path: string) => void
	rename: (path: string) => void
	toggleBookmark?: (path: string) => void
	isBookmarked?: (path: string) => boolean
	manageTags?: (path: string) => void
	moveTo?: (path: string) => void
	copyFile?: (path: string) => void
	delete: (path: string, isDirectory: boolean) => void
	copyPath?: (path: string) => void
	copyRelativePath?: (path: string) => void
	showInExplorer?: (path: string) => void
	showVersionHistory?: (path: string) => void
	toggleSyncIgnore?: (path: string, ignored: boolean) => void
	isSyncIgnored?: (path: string) => boolean
}

export function buildFileContextMenuItems(
	ctx: FileContextMenuContext,
	actions: FileContextMenuActions,
): MenuItem[] {
	const { path, isDirectory, selectionCount, isMultiSelect } = ctx
	const items: MenuItem[] = []

	items.push({
		id: "new-file",
		type: "normal",
		text: "New File",
		action: () => actions.createFile(isDirectory ? path : undefined),
	})
	items.push({
		id: "new-folder",
		type: "normal",
		text: "New Folder",
		action: () => actions.createFolder(isDirectory ? path : undefined),
	})
	items.push({ type: "separator" })

	if (!isDirectory) {
		items.push({
			id: "open-new-tab",
			type: "normal",
			text: "Open in New Tab",
			action: () => actions.openInNewTab(path),
		})
		if (actions.openInRightSplit) {
			items.push({
				id: "open-right-split",
				type: "normal",
				text: "Open in Right Split",
				action: () => actions.openInRightSplit!(path),
			})
		}
	}

	items.push({
		id: "rename",
		type: "normal",
		text: "Rename",
		action: () => actions.rename(path),
	})

	if (!isDirectory && actions.toggleBookmark) {
		const bookmarked = actions.isBookmarked?.(path) ?? false
		items.push({
			id: bookmarked ? "remove-bookmark" : "add-bookmark",
			type: "normal",
			text: bookmarked ? "Remove Bookmark" : "Add Bookmark",
			accelerator: "CmdOrCtrl+Shift+B",
			action: () => actions.toggleBookmark?.(path),
		})

		if (actions.manageTags) {
			items.push({
				id: "manage-tags",
				type: "normal",
				text: "Manage Tags",
				action: () => actions.manageTags!(path),
			})
		}
	}

	if (actions.moveTo) {
		items.push({
			id: "move-to",
			type: "normal",
			text: "Move To...",
			action: () => actions.moveTo!(path),
		})
	}

	if (actions.copyFile) {
		items.push({
			id: "copy-file",
			type: "normal",
			text: "Make a Copy",
			action: () => actions.copyFile!(path),
		})
	}

	items.push({
		id: "delete",
		type: "normal",
		text: isMultiSelect ? `Delete (${selectionCount})` : "Delete",
		action: () => actions.delete(path, isDirectory),
	})

	items.push({ type: "separator" })

	if (actions.copyPath) {
		items.push({
			id: "copy-path",
			type: "normal",
			text: "Copy Path",
			action: () => actions.copyPath!(path),
		})
	}

	if (actions.copyRelativePath) {
		items.push({
			id: "copy-relative-path",
			type: "normal",
			text: "Copy Relative Path",
			action: () => actions.copyRelativePath!(path),
		})
	}

	if (actions.showInExplorer) {
		items.push({
			id: "show-in-explorer",
			type: "normal",
			text: "Show in System Explorer",
			action: () => actions.showInExplorer!(path),
		})
	}

	if (!isDirectory && actions.showVersionHistory) {
		items.push({ type: "separator" })
		items.push({
			id: "version-history",
			type: "normal",
			text: "Version History",
			action: () => actions.showVersionHistory!(path),
		})
	}

	if (actions.toggleSyncIgnore && actions.isSyncIgnored) {
		items.push({ type: "separator" })
		if (actions.isSyncIgnored(path)) {
			items.push({
				id: "include-in-sync",
				type: "normal",
				text: "Include in Sync",
				action: () => actions.toggleSyncIgnore!(path, false),
			})
		} else {
			items.push({
				id: "exclude-from-sync",
				type: "normal",
				text: "Exclude from Sync",
				action: () => actions.toggleSyncIgnore!(path, true),
			})
		}
	}

	return items
}

export function buildRootContextMenuItems(
	rootPath: string,
	actions: Pick<FileContextMenuActions, "createFile" | "createFolder">,
): MenuItem[] {
	return [
		{
			id: "new-file",
			type: "normal",
			text: "New File",
			action: () => actions.createFile(rootPath),
		},
		{
			id: "new-folder",
			type: "normal",
			text: "New Folder",
			action: () => actions.createFolder(rootPath),
		},
	]
}
