import { getParentPath, getRelativePath, joinPath, useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { useCallback } from "react"

export function useImagePaste(filePath: string): (imageBlob: Blob) => Promise<string | null> {
	return useCallback(
		async (imageBlob: Blob): Promise<string | null> => {
			const vaultPath = useVaultStore.getState().vault?.path
			if (!vaultPath) return null

			const editorSettings = useSettingsStore.getState().settings.editor
			const fileDir = getParentPath(filePath)

			let targetDir: string
			if (editorSettings.imageStorageLocation === "root") {
				targetDir = vaultPath
			} else if (editorSettings.imageStorageLocation === "custom") {
				const customPath = editorSettings.imageStorageCustomPath
				targetDir = customPath ? joinPath(vaultPath, customPath) : vaultPath
			} else {
				targetDir = fileDir
			}

			const extension = extensionFromMimeType(imageBlob.type)
			const fileName = `paste-${Date.now()}${extension}`
			const targetPath = joinPath(targetDir, fileName)

			const data = new Uint8Array(await imageBlob.arrayBuffer())
			await getPlatform().fs.writeBinaryFile(targetPath, data)

			const relativePath = getRelativePath(fileDir, targetPath)
			return `![${fileName}](${relativePath.startsWith(".") ? relativePath : `./${relativePath}`})`
		},
		[filePath],
	)
}

function extensionFromMimeType(mimeType: string): string {
	if (mimeType === "image/jpeg") return ".jpg"
	if (mimeType === "image/webp") return ".webp"
	if (mimeType === "image/gif") return ".gif"
	return ".png"
}
