import { normalizePath, splitExtension } from "@cortex/platform/utils"

export function sanitizeFileStem(value: string): string {
	const sanitized = value
		.replace(/[<>:"\\|?*\p{Cc}]/gu, "-")
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
	const directory = normalizePath(directoryPath)
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
