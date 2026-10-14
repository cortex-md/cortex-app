import { getParentPath, getRelativePath, joinPath, useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"

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

export function extensionForMimeType(mimeType: string | undefined): string | null {
	if (mimeType === "image/jpeg") return ".jpg"
	if (mimeType === "image/webp") return ".webp"
	if (mimeType === "image/gif") return ".gif"
	if (mimeType === "image/heic") return ".heic"
	if (mimeType === "image/png") return ".png"
	return null
}

export async function writeNoteImage(
	filePath: string,
	bytes: Uint8Array,
	extension: string,
): Promise<string | null> {
	const vaultPath = useVaultStore.getState().vault?.path
	if (!vaultPath) return null
	const fileName = `image-${Date.now()}${extension}`
	const targetPath = joinPath(imageDirectory(filePath, vaultPath), fileName)
	await getPlatform().fs.writeBinaryFile(targetPath, bytes)
	const relativePath = getRelativePath(getParentPath(filePath), targetPath)
	const link = relativePath.startsWith(".") ? relativePath : `./${relativePath}`
	return `![${fileName}](${link})`
}

export function saveNoteImage(
	filePath: string,
	bytes: Uint8Array,
	mimeType: string,
): Promise<string | null> {
	return writeNoteImage(filePath, bytes, extensionForMimeType(mimeType) ?? ".png")
}
