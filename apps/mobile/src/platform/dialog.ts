import type { AlertDialogOptions, ConfirmDialogOptions, Platform } from "@cortex/platform"
import { toMessageOptions } from "@cortex/platform/utils"
import { Directory } from "expo-file-system"
import { Alert } from "react-native"

import { unsupportedPhase1 } from "./unsupported"
import { registerPickedDirectory } from "./vaultRoots"

function isPickerCancelled(error: unknown): boolean {
	if (!(error instanceof Error)) return false
	return /cancel|dismiss|abort/iu.test(error.message)
}

export const dialogApi = {
	pickFile: () => unsupportedPhase1("dialog.pickFile"),
	pickFiles: () => unsupportedPhase1("dialog.pickFiles"),
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
