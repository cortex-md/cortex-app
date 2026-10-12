export const COMMENTS_DIRECTORY = ".cortex/comments"

const SIDECAR_EXTENSION = ".json"

function normalizeRelativePath(relativePath: string): string {
	return relativePath.replace(/\\/g, "/").replace(/^\/+/, "")
}

export function commentsSidecarPath(relativeNotePath: string): string {
	return `${COMMENTS_DIRECTORY}/${normalizeRelativePath(relativeNotePath)}${SIDECAR_EXTENSION}`
}

export function isCommentsSidecarPath(relativePath: string): boolean {
	const normalized = normalizeRelativePath(relativePath)
	return normalized.startsWith(`${COMMENTS_DIRECTORY}/`) && normalized.endsWith(SIDECAR_EXTENSION)
}

export function notePathFromSidecar(relativeSidecarPath: string): string | null {
	if (!isCommentsSidecarPath(relativeSidecarPath)) return null
	const normalized = normalizeRelativePath(relativeSidecarPath)
	return normalized.slice(COMMENTS_DIRECTORY.length + 1, -SIDECAR_EXTENSION.length)
}
