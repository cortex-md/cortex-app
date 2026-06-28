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
	const normalizedFilePath = filePath.replaceAll("\\", "/")
	const normalizedVaultPath = vaultPath?.replaceAll("\\", "/").replace(/\/+$/, "")
	const vaultPrefix = normalizedVaultPath ? `${normalizedVaultPath}/` : null
	const relativePath =
		vaultPrefix && normalizedFilePath.startsWith(vaultPrefix)
			? normalizedFilePath.slice(vaultPrefix.length)
			: (normalizedFilePath.split("/").pop() ?? normalizedFilePath)
	const segments = relativePath.split("/").filter(Boolean)
	const fileName = segments.at(-1) ?? ""
	const title = fileName.replace(/\.md$/i, "")

	if (segments.length > 0) segments[segments.length - 1] = title

	return {
		title,
		segments: segments.map((label, index) => ({
			id: segments.slice(0, index + 1).join("/"),
			label,
		})),
	}
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
