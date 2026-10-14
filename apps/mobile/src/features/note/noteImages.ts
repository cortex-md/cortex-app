import {
	getErrorMessage,
	getParentPath,
	getRelativePath,
	joinPath,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { File } from "expo-file-system"
import * as ImagePicker from "expo-image-picker"

import { toast } from "@/features/feedback/useToast"
import { workspaceChannel } from "@/features/workspace/workspaceChannel"

const MOBILE_INSERT_TEXT_COMMAND = "mobile.insert-text"

function imageDirectory(filePath: string, vaultPath: string): string {
	const editor = useSettingsStore.getState().settings.editor
	if (editor.imageStorageLocation === "root") return vaultPath
	if (editor.imageStorageLocation === "custom") {
		return editor.imageStorageCustomPath
			? joinPath(vaultPath, editor.imageStorageCustomPath)
			: vaultPath
	}
	return getParentPath(filePath)
}

function extensionFor(asset: ImagePicker.ImagePickerAsset): string {
	if (asset.mimeType === "image/jpeg") return ".jpg"
	if (asset.mimeType === "image/webp") return ".webp"
	if (asset.mimeType === "image/gif") return ".gif"
	if (asset.mimeType === "image/heic") return ".heic"
	const fromName = asset.fileName?.match(/\.[a-z0-9]+$/i)?.[0]
	return fromName?.toLowerCase() ?? ".png"
}

export async function insertImageFromLibrary(filePath: string): Promise<void> {
	const vaultPath = useVaultStore.getState().vault?.path
	if (!vaultPath) return
	try {
		const result = await ImagePicker.launchImageLibraryAsync({
			allowsMultipleSelection: false,
			mediaTypes: ["images"],
			quality: 0.9,
		})
		const asset = result.canceled ? null : result.assets[0]
		if (!asset) return
		const fileName = `image-${Date.now()}${extensionFor(asset)}`
		const targetPath = joinPath(imageDirectory(filePath, vaultPath), fileName)
		await getPlatform().fs.writeBinaryFile(targetPath, await new File(asset.uri).bytes())
		const relativePath = getRelativePath(getParentPath(filePath), targetPath)
		const link = relativePath.startsWith(".") ? relativePath : `./${relativePath}`
		workspaceChannel.sendCommand(MOBILE_INSERT_TEXT_COMMAND, `![${fileName}](${link})`)
	} catch (error) {
		toast(getErrorMessage(error))
	}
}
