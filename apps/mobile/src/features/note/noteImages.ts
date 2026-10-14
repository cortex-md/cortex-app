import { getErrorMessage } from "@cortex/core"
import { File } from "expo-file-system"
import * as ImagePicker from "expo-image-picker"

import { toast } from "@/features/feedback/useToast"
import { extensionForMimeType, writeNoteImage } from "@/features/note/noteImageFiles"
import { workspaceChannel } from "@/features/workspace/workspaceChannel"

const MOBILE_INSERT_TEXT_COMMAND = "mobile.insert-text"

function extensionFor(asset: ImagePicker.ImagePickerAsset): string {
	const fromName = asset.fileName?.match(/\.[a-z0-9]+$/i)?.[0]
	return extensionForMimeType(asset.mimeType) ?? fromName?.toLowerCase() ?? ".png"
}

export async function insertImageFromLibrary(filePath: string): Promise<void> {
	try {
		const result = await ImagePicker.launchImageLibraryAsync({
			allowsMultipleSelection: false,
			mediaTypes: ["images"],
			quality: 0.9,
		})
		const asset = result.canceled ? null : result.assets[0]
		if (!asset) return
		const markdown = await writeNoteImage(
			filePath,
			await new File(asset.uri).bytes(),
			extensionFor(asset),
		)
		if (markdown) workspaceChannel.sendCommand(MOBILE_INSERT_TEXT_COMMAND, markdown)
	} catch (error) {
		toast(getErrorMessage(error))
	}
}
