export function normalizeTransferPath(path: string): string {
	return path.replaceAll("\\", "/").replace(/\/+$/u, "")
}

export function getPathName(path: string): string {
	const normalized = normalizeTransferPath(path)
	return normalized.split("/").pop() ?? normalized
}

export function getParentPath(path: string): string {
	const normalized = normalizeTransferPath(path)
	const index = normalized.lastIndexOf("/")
	return index === -1 ? "" : normalized.slice(0, index)
}

export function splitExtension(fileName: string): { baseName: string; extension: string } {
	const dotIndex = fileName.lastIndexOf(".")
	if (dotIndex <= 0) return { baseName: fileName, extension: "" }
	return {
		baseName: fileName.slice(0, dotIndex),
		extension: fileName.slice(dotIndex),
	}
}

export function getExtension(path: string): string {
	return splitExtension(getPathName(path)).extension.slice(1).toLocaleLowerCase()
}

export function sanitizeFileStem(value: string): string {
	const sanitized = value
		.replace(/[<>:"\\|?*\u0000-\u001f]/gu, "-")
		.replace(/\s+/gu, " ")
		.replace(/^\.+/u, "")
		.trim()
	return sanitized || "Imported Note"
}

export function reserveUniquePath(
	directoryPath: string,
	fileName: string,
	reservedPaths: Set<string>,
): string {
	const directory = normalizeTransferPath(directoryPath)
	const { baseName, extension } = splitExtension(fileName)
	let candidate = `${directory}/${fileName}`
	let suffix = 2
	while (reservedPaths.has(candidate)) {
		candidate = `${directory}/${baseName} ${suffix}${extension}`
		suffix += 1
	}
	reservedPaths.add(candidate)
	return candidate
}

export function getRelativePath(fromDirectoryPath: string, targetPath: string): string {
	const fromParts = normalizeTransferPath(fromDirectoryPath).split("/").filter(Boolean)
	const targetParts = normalizeTransferPath(targetPath).split("/").filter(Boolean)
	let commonLength = 0
	while (
		commonLength < fromParts.length &&
		commonLength < targetParts.length &&
		fromParts[commonLength] === targetParts[commonLength]
	) {
		commonLength += 1
	}
	const parents = fromParts.slice(commonLength).map(() => "..")
	const targetRemainder = targetParts.slice(commonLength)
	const relative = [...parents, ...targetRemainder].join("/")
	return relative || getPathName(targetPath)
}

