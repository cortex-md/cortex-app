import type { SharedNoteBundle } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { getBaseName, joinPath } from "@cortex/platform/utils"
import { getVaultIndex, trackCreatedFiles } from "../stores/vaultStore"
import { rewriteAttachmentLinks } from "./sharedNote"

export interface SharedNoteNaming {
	sanitizeFileStem: (value: string) => string
	reserveUniquePath: (directoryPath: string, fileName: string, reservedPaths: Set<string>) => string
}

export function fromBase64(data: string): Uint8Array {
	return Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
}

export async function saveSharedNoteCopy(
	bundle: SharedNoteBundle,
	vaultPath: string,
	{ sanitizeFileStem, reserveUniquePath }: SharedNoteNaming,
): Promise<string> {
	const fs = getPlatform().fs
	const existing = new Set(
		getVaultIndex()
			.getFiles()
			.map((file) => file.path),
	)
	const stem = sanitizeFileStem(bundle.title) || "Shared note"
	const notePath = reserveUniquePath(vaultPath, `${stem}.md`, existing)
	const assetsFolder = `${getBaseName(notePath).replace(/\.md$/, "")} files`
	if (bundle.attachments.length > 0) await fs.createDir(joinPath(vaultPath, assetsFolder))
	const names = new Set<string>()
	const relativePaths = await Promise.all(
		bundle.attachments.map(async (attachment) => {
			const assetPath = reserveUniquePath(
				joinPath(vaultPath, assetsFolder),
				sanitizeFileStem(getBaseName(attachment.path)) || "image",
				names,
			)
			names.add(assetPath)
			await fs.writeBinaryFile(assetPath, fromBase64(attachment.data))
			return `${assetsFolder}/${getBaseName(assetPath)}`
		}),
	)
	await fs.writeFile(
		notePath,
		rewriteAttachmentLinks(bundle, (index) => relativePaths[index] ?? ""),
	)
	trackCreatedFiles(
		[notePath, ...relativePaths.flatMap((path) => (path ? [joinPath(vaultPath, path)] : []))],
		bundle.attachments.length > 0 ? [joinPath(vaultPath, assetsFolder)] : [],
	)
	return notePath
}
