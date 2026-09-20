export type DialogKind = "info" | "warning" | "error"

export interface DialogFilter {
	name: string
	extensions: string[]
}

export interface FolderDialogOptions {
	title?: string
	defaultPath?: string
	multiple?: false
}

export interface FileDialogOptions {
	title?: string
	defaultPath?: string
	filters?: DialogFilter[]
	multiple?: boolean
}

export interface ConfirmDialogOptions {
	title: string
	message: string
	kind?: DialogKind
	confirmLabel?: string
	cancelLabel?: string
	destructive?: boolean
}

export interface AlertDialogOptions {
	title: string
	message: string
	kind?: DialogKind
	okLabel?: string
}

export type ContextMenuItemType = "normal" | "separator" | "checkbox" | "submenu"

export interface ContextMenuItemBase {
	id: string
	text: string
	enabled?: boolean
	accelerator?: string
	destructive?: boolean
}

export interface ContextMenuNormalItem extends ContextMenuItemBase {
	type?: "normal"
}

export interface ContextMenuSeparatorItem {
	type: "separator"
}

export interface ContextMenuCheckboxItem extends ContextMenuItemBase {
	type: "checkbox"
	checked: boolean
}

export interface ContextMenuSubmenuItem extends ContextMenuItemBase {
	type: "submenu"
	items: ContextMenuItem[]
}

export type ContextMenuItem =
	| ContextMenuNormalItem
	| ContextMenuSeparatorItem
	| ContextMenuCheckboxItem
	| ContextMenuSubmenuItem

export interface ContextMenuPosition {
	x: number
	y: number
}

export interface ContextMenuOptions {
	items: ContextMenuItem[]
	position?: ContextMenuPosition
}

export interface Dialog {
	pickFolder(options?: string | FolderDialogOptions): Promise<string | null>
	pickFile(options?: FileDialogOptions): Promise<string | null>
	pickFiles(options?: FileDialogOptions): Promise<string[]>
	saveFile(options?: FileDialogOptions): Promise<string | null>
	showConfirm(title: string, message: string): Promise<boolean>
	showConfirm(options: ConfirmDialogOptions): Promise<boolean>
	showAlert(title: string, message: string): Promise<void>
	showAlert(options: AlertDialogOptions): Promise<void>
	revealFolder(path: string): Promise<void>
	showContextMenu(options: ContextMenuOptions): Promise<string | null>
}
