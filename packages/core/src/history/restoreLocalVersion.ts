import { getPlatform } from "@cortex/platform"
import { noteCache } from "../noteCache"
import { mutateNote } from "../notes/mutateNote"
import { assertVaultPathWritable } from "../stores/accessStore"
import { captureLocalVersion, type LocalVersionReason, readLocalVersion } from "./localHistory"

export async function readCurrentNoteContent(filePath: string): Promise<string> {
	return noteCache.getEntry(filePath)?.content ?? (await getPlatform().fs.readFile(filePath))
}

export function captureCurrentNoteVersion(
	filePath: string,
	reason: LocalVersionReason,
): Promise<void> {
	return captureLocalVersion(filePath, () => readCurrentNoteContent(filePath), reason)
}

export async function restoreLocalVersion(filePath: string, versionId: string): Promise<void> {
	assertVaultPathWritable(filePath)
	const content = await readLocalVersion(filePath, versionId)
	await mutateNote(filePath, () => content, { historyReason: "restore" })
	await noteCache.flush(filePath)
}
