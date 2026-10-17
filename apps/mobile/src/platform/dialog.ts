import type {
	AlertDialogOptions,
	ConfirmDialogOptions,
	FileDialogOptions,
	Platform,
} from "@cortex/platform"
import { toMessageOptions } from "@cortex/platform/utils"
import * as DocumentPicker from "expo-document-picker"
import { Directory, File } from "expo-file-system"
import { Alert } from "react-native"

import { getAppDirectory, normalizeUri } from "./appStorage"
import { unsupportedPhase1 } from "./unsupported"
import { registerPickedDirectory } from "./vaultRoots"

const STAGING_DIRECTORY = ".picked"

function allowedExtensions(options?: FileDialogOptions): Set<string> | null {
	const extensions = options?.filters?.flatMap((filter) => filter.extensions) ?? []
	if (extensions.length === 0 || extensions.includes("*")) return null
	return new Set(extensions.map((extension) => extension.toLowerCase()))
}

function stagingDirectory(): Directory {
	const root = new Directory(getAppDirectory(), STAGING_DIRECTORY)
	if (root.exists) root.delete()
	const directory = new Directory(root, String(Date.now()))
	directory.create({ idempotent: true, intermediates: true })
	return directory
}

async function pickDocuments(options: FileDialogOptions | undefined, multiple: boolean) {
	const result = await DocumentPicker.getDocumentAsync({
		copyToCacheDirectory: true,
		multiple,
		type: "*/*",
	})
	if (result.canceled) return []
	const allowed = allowedExtensions(options)
	const assets = result.assets.filter((asset) => {
		if (!allowed) return true
		const extension = asset.name.split(".").pop()?.toLowerCase() ?? ""
		return allowed.has(extension)
	})
	if (assets.length === 0) return []
	const directory = stagingDirectory()
	return assets.map((asset) => {
		const target = new File(directory, asset.name)
		new File(asset.uri).move(target)
		return normalizeUri(target.uri)
	})
}

function isPickerCancelled(error: unknown): boolean {
	if (!(error instanceof Error)) return false
	return /cancel|dismiss|abort/iu.test(error.message)
}

export const dialogApi = {
	pickFile: async (options) => (await pickDocuments(options, false))[0] ?? null,
	pickFiles: (options) => pickDocuments(options, true),
	pickFolder: async () => {
		try {
			const directory = await Directory.pickDirectoryAsync()
			return registerPickedDirectory(directory)
		} catch (error) {
			if (isPickerCancelled(error)) return null
			throw error
		}
	},
	revealFolder: () => unsupportedPhase1("dialog.revealFolder"),
	saveFile: () => unsupportedPhase1("dialog.saveFile"),
	showAlert: async (titleOrOptions: string | AlertDialogOptions, message?: string) => {
		const options = toMessageOptions(titleOrOptions, message)
		return new Promise<void>((resolve) => {
			Alert.alert(options.title, options.message, [
				{
					onPress: () => resolve(),
					text: options.okLabel ?? "OK",
				},
			])
		})
	},
	showConfirm: async (titleOrOptions: string | ConfirmDialogOptions, message?: string) => {
		const options = toMessageOptions(titleOrOptions, message)
		return new Promise<boolean>((resolve) => {
			Alert.alert(options.title, options.message, [
				{
					onPress: () => resolve(false),
					style: "cancel",
					text: options.cancelLabel ?? "Cancel",
				},
				{
					onPress: () => resolve(true),
					style: options.destructive ? "destructive" : "default",
					text: options.confirmLabel ?? "OK",
				},
			])
		})
	},
	showContextMenu: () => unsupportedPhase1("dialog.showContextMenu"),
} satisfies Platform["dialog"]
