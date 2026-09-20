import type {
	AlertDialogOptions,
	ConfirmDialogOptions,
	ContextMenuOptions,
	FileDialogOptions,
	FolderDialogOptions,
	Dialog as IDialog,
} from "@cortex/platform"
import { invoke } from "./bridge"
import { normalizeNativePath } from "./path"

function resolveFolderOptions(options?: string | FolderDialogOptions) {
	if (typeof options === "string") return { title: options }
	return options ?? {}
}

function resolveConfirmOptions(
	titleOrOptions: string | ConfirmDialogOptions,
	messageText?: string,
): ConfirmDialogOptions {
	if (typeof titleOrOptions === "string") {
		return { title: titleOrOptions, message: messageText ?? "" }
	}
	return titleOrOptions
}

function resolveAlertOptions(
	titleOrOptions: string | AlertDialogOptions,
	messageText?: string,
): AlertDialogOptions {
	if (typeof titleOrOptions === "string") {
		return { title: titleOrOptions, message: messageText ?? "" }
	}
	return titleOrOptions
}

export class Dialog implements IDialog {
	async pickFolder(options?: string | FolderDialogOptions): Promise<string | null> {
		const selected = await invoke<string | null>("dialog_pick_folder", resolveFolderOptions(options))
		return selected ? normalizeNativePath(selected) : null
	}

	async pickFile(options: FileDialogOptions = {}): Promise<string | null> {
		const selected = await invoke<string | null>("dialog_pick_file", options)
		return selected ? normalizeNativePath(selected) : null
	}

	async pickFiles(options: FileDialogOptions = {}): Promise<string[]> {
		const selected = await invoke<string[]>("dialog_pick_files", options)
		return selected.map(normalizeNativePath)
	}

	async saveFile(options: FileDialogOptions = {}): Promise<string | null> {
		const selected = await invoke<string | null>("dialog_save_file", options)
		return selected ? normalizeNativePath(selected) : null
	}

	async showConfirm(title: string, message: string): Promise<boolean>
	async showConfirm(options: ConfirmDialogOptions): Promise<boolean>
	async showConfirm(
		titleOrOptions: string | ConfirmDialogOptions,
		messageText?: string,
	): Promise<boolean> {
		return await invoke<boolean>("dialog_show_confirm", resolveConfirmOptions(titleOrOptions, messageText))
	}

	async showAlert(title: string, message: string): Promise<void>
	async showAlert(options: AlertDialogOptions): Promise<void>
	async showAlert(
		titleOrOptions: string | AlertDialogOptions,
		messageText?: string,
	): Promise<void> {
		await invoke<void>("dialog_show_alert", resolveAlertOptions(titleOrOptions, messageText))
	}

	async revealFolder(path: string): Promise<void> {
		await invoke<void>("dialog_reveal_folder", { path })
	}

	async showContextMenu(options: ContextMenuOptions): Promise<string | null> {
		return await invoke<string | null>("dialog_show_context_menu", {
			items: options.items,
			position: options.position ?? null,
		})
	}
}
