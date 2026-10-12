import type {
	AlertDialogOptions,
	ConfirmDialogOptions,
	ContextMenuItem,
	ContextMenuOptions,
	DialogFilter,
	FileDialogOptions,
	FolderDialogOptions,
} from "@cortex/platform"
import { normalizePath } from "@cortex/platform/utils"
import {
	BrowserWindow,
	dialog,
	Menu,
	type MenuItemConstructorOptions,
	type OpenDialogOptions,
	type SaveDialogOptions,
	shell,
} from "electron"
import type { MainApi } from "../contract"
import { getInvokeSender } from "../ipc/sender"
import { assertAllowedPath, grantPath } from "../security"

function grantSelection(path: string): string {
	grantPath(path)
	return normalizePath(path)
}

function focusedWindow(): BrowserWindow | undefined {
	const sender = getInvokeSender()
	return (
		(sender && BrowserWindow.fromWebContents(sender)) ||
		BrowserWindow.getFocusedWindow() ||
		undefined
	)
}

function toElectronFilters(filters?: DialogFilter[]): OpenDialogOptions["filters"] {
	if (!filters?.length) return undefined
	return filters.map((filter) => ({
		name: filter.name,
		extensions: filter.extensions.map((extension) => extension.replace(/^\./, "")),
	}))
}

async function pickFolder(options: FolderDialogOptions = {}): Promise<string | null> {
	const window = focusedWindow()
	const openOptions: OpenDialogOptions = {
		title: options.title,
		defaultPath: options.defaultPath,
		properties: ["openDirectory", "createDirectory"],
	}
	const result = window
		? await dialog.showOpenDialog(window, openOptions)
		: await dialog.showOpenDialog(openOptions)
	if (result.canceled || result.filePaths.length === 0) return null
	return grantSelection(result.filePaths[0]!)
}

async function pickFile(options: FileDialogOptions = {}): Promise<string | null> {
	const window = focusedWindow()
	const openOptions: OpenDialogOptions = {
		title: options.title,
		defaultPath: options.defaultPath,
		filters: toElectronFilters(options.filters),
		properties: ["openFile"],
	}
	const result = window
		? await dialog.showOpenDialog(window, openOptions)
		: await dialog.showOpenDialog(openOptions)
	if (result.canceled || result.filePaths.length === 0) return null
	return grantSelection(result.filePaths[0]!)
}

async function pickFiles(options: FileDialogOptions = {}): Promise<string[]> {
	const window = focusedWindow()
	const openOptions: OpenDialogOptions = {
		title: options.title,
		defaultPath: options.defaultPath,
		filters: toElectronFilters(options.filters),
		properties: ["openFile", "multiSelections"],
	}
	const result = window
		? await dialog.showOpenDialog(window, openOptions)
		: await dialog.showOpenDialog(openOptions)
	if (result.canceled) return []
	return result.filePaths.map(grantSelection)
}

async function saveFile(options: FileDialogOptions = {}): Promise<string | null> {
	const window = focusedWindow()
	const saveOptions: SaveDialogOptions = {
		title: options.title,
		defaultPath: options.defaultPath,
		filters: toElectronFilters(options.filters),
	}
	const result = window
		? await dialog.showSaveDialog(window, saveOptions)
		: await dialog.showSaveDialog(saveOptions)
	if (result.canceled || !result.filePath) return null
	return grantSelection(result.filePath)
}

async function showConfirm(options: ConfirmDialogOptions): Promise<boolean> {
	const window = focusedWindow()
	const messageOptions = {
		type: options.kind ?? (options.destructive ? ("warning" as const) : ("question" as const)),
		title: options.title,
		message: options.title,
		detail: options.message,
		buttons: [options.confirmLabel ?? "OK", options.cancelLabel ?? "Cancel"],
		defaultId: options.destructive ? 1 : 0,
		cancelId: 1,
	}
	const result = window
		? await dialog.showMessageBox(window, messageOptions)
		: await dialog.showMessageBox(messageOptions)
	return result.response === 0
}

async function showAlert(options: AlertDialogOptions): Promise<void> {
	const window = focusedWindow()
	const messageOptions = {
		type: options.kind ?? ("info" as const),
		title: options.title,
		message: options.title,
		detail: options.message,
		buttons: [options.okLabel ?? "OK"],
	}
	if (window) {
		await dialog.showMessageBox(window, messageOptions)
	} else {
		await dialog.showMessageBox(messageOptions)
	}
}

async function revealFolder(path: string): Promise<void> {
	shell.showItemInFolder(assertAllowedPath(path))
}

function toMenuTemplate(
	items: ContextMenuItem[],
	resolveClick: (id: string) => void,
): MenuItemConstructorOptions[] {
	return items.map((item) => {
		if (item.type === "separator") {
			return { type: "separator" }
		}
		if (item.type === "submenu") {
			return {
				label: item.text,
				enabled: item.enabled !== false,
				accelerator: item.accelerator,
				submenu: toMenuTemplate(item.items, resolveClick),
			}
		}
		if (item.type === "checkbox") {
			return {
				type: "checkbox",
				id: item.id,
				label: item.text,
				checked: item.checked,
				enabled: item.enabled !== false,
				accelerator: item.accelerator,
				click: () => resolveClick(item.id),
			}
		}
		return {
			id: item.id,
			label: item.text,
			enabled: item.enabled !== false,
			accelerator: item.accelerator,
			click: () => resolveClick(item.id),
		}
	})
}

async function showContextMenu(options: ContextMenuOptions): Promise<string | null> {
	return await new Promise((resolvePromise) => {
		let settled = false
		const finish = (id: string | null) => {
			if (settled) return
			settled = true
			resolvePromise(id)
		}

		const menu = Menu.buildFromTemplate(
			toMenuTemplate(options.items, (id) => {
				finish(id)
			}),
		)

		menu.popup({
			window: focusedWindow(),
			x: options.position?.x,
			y: options.position?.y,
			callback: () => finish(null),
		})
	})
}

export const dialogApi = {
	pickFolder,
	pickFile,
	pickFiles,
	saveFile,
	showConfirm,
	showAlert,
	revealFolder,
	showContextMenu,
} satisfies MainApi["dialog"]
