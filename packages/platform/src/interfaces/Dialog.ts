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
	multiple?: false
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

export interface Dialog {
	pickFolder(options?: string | FolderDialogOptions): Promise<string | null>
	pickFile(options?: FileDialogOptions): Promise<string | null>
	saveFile(options?: FileDialogOptions): Promise<string | null>
	showConfirm(title: string, message: string): Promise<boolean>
	showConfirm(options: ConfirmDialogOptions): Promise<boolean>
	showAlert(title: string, message: string): Promise<void>
	showAlert(options: AlertDialogOptions): Promise<void>
	revealFolder(path: string): Promise<void>
}
