import type {
	AlertDialogOptions,
	ConfirmDialogOptions,
	FileDialogOptions,
	FolderDialogOptions,
	Dialog as IDialog,
} from "@cortex/platform"
import { confirm, message, open, save } from "@tauri-apps/plugin-dialog"
import { revealItemInDir } from "@tauri-apps/plugin-opener"

function resolveFolderOptions(options?: string | FolderDialogOptions) {
	if (typeof options === "string") return { title: options, directory: true, multiple: false }
	return { ...options, directory: true, multiple: false }
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
		const selected = await open(resolveFolderOptions(options))
		if (Array.isArray(selected)) return selected[0] ?? null
		return selected
	}

	async pickFile(options: FileDialogOptions = {}): Promise<string | null> {
		const selected = await open({ ...options, multiple: false })
		if (Array.isArray(selected)) return selected[0] ?? null
		return selected
	}

	async saveFile(options: FileDialogOptions = {}): Promise<string | null> {
		return await save(options)
	}

	async showConfirm(title: string, message: string): Promise<boolean>
	async showConfirm(options: ConfirmDialogOptions): Promise<boolean>
	async showConfirm(
		titleOrOptions: string | ConfirmDialogOptions,
		messageText?: string,
	): Promise<boolean> {
		const options = resolveConfirmOptions(titleOrOptions, messageText)
		return await confirm(options.message, {
			title: options.title,
			kind: options.destructive ? "warning" : (options.kind ?? "info"),
			okLabel: options.confirmLabel,
			cancelLabel: options.cancelLabel,
		})
	}

	async showAlert(title: string, message: string): Promise<void>
	async showAlert(options: AlertDialogOptions): Promise<void>
	async showAlert(
		titleOrOptions: string | AlertDialogOptions,
		messageText?: string,
	): Promise<void> {
		const options = resolveAlertOptions(titleOrOptions, messageText)
		await message(options.message, {
			title: options.title,
			kind: options.kind ?? "info",
			okLabel: options.okLabel,
		})
	}

	async revealFolder(path: string): Promise<void> {
		await revealItemInDir(path)
	}
}
