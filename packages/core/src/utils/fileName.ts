import {
	ensureMarkdownExtension,
	getBaseName,
	isMarkdownPath,
	stripMarkdownExtension,
	toVaultRelativePath,
} from "@cortex/platform/utils"

const portableInvalidCharacters = /[<>:"/\\|?*]/
const windowsReservedName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

export interface NotePathSegment {
	id: string
	label: string
}

export interface NotePathPresentation {
	title: string
	segments: NotePathSegment[]
}

export function getNotePathPresentation(
	filePath: string,
	vaultPath?: string,
): NotePathPresentation {
	const relativePath =
		(vaultPath ? toVaultRelativePath(filePath, vaultPath) : null) || getBaseName(filePath)
	const segments = relativePath.split("/").filter(Boolean)
	const title = stripMarkdownExtension(segments.at(-1) ?? "")

	if (segments.length > 0) segments[segments.length - 1] = title

	return {
		title,
		segments: segments.map((label, index) => ({
			id: segments.slice(0, index + 1).join("/"),
			label,
		})),
	}
}

export function getNoteFolderSegments(filePath: string, vaultPath?: string): NotePathSegment[] {
	return getNotePathPresentation(filePath, vaultPath).segments.slice(0, -1)
}

export function getPortableFileNameError(fileName: string): string | null {
	if (!fileName.trim()) return "File name cannot be empty"
	if (fileName === "." || fileName === "..") return "File name is reserved"
	if (
		portableInvalidCharacters.test(fileName) ||
		Array.from(fileName).some((character) => character.charCodeAt(0) < 32)
	) {
		return "File name contains characters that are not supported on every platform"
	}
	if (/[. ]$/.test(fileName)) return "File name cannot end with a period or space"
	if (windowsReservedName.test(fileName)) return "File name is reserved by the operating system"
	return null
}

export function getNoteTitleError(title: string): string | null {
	const normalizedTitle = title.trim()
	if (!normalizedTitle) return "File name cannot be empty"
	return getPortableFileNameError(`${normalizedTitle}.md`)
}

export type EntryNameKind = "note" | "folder" | "file"

export interface NamedEntry {
	name: string
	isDir: boolean
}

export function getEntryNameKind(entry: NamedEntry): EntryNameKind {
	if (entry.isDir) return "folder"
	return isMarkdownPath(entry.name) ? "note" : "file"
}

export function getEditableEntryName(entry: NamedEntry): string {
	return getEntryNameKind(entry) === "note" ? stripMarkdownExtension(entry.name) : entry.name
}

export function toEntryFileName(kind: EntryNameKind, value: string): string {
	const name = value.trim()
	return kind === "note" ? ensureMarkdownExtension(name) : name
}

export function validateEntryName(kind: EntryNameKind, value: string): string | null {
	return kind === "note" ? getNoteTitleError(value) : getPortableFileNameError(value.trim())
}
