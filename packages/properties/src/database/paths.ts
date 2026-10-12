function normalize(path: string): string {
	const slashed = path.replaceAll("\\", "/")
	return slashed.length > 1 ? slashed.replace(/\/+$/u, "") : slashed
}

function parentOf(path: string): string {
	const normalized = normalize(path)
	const index = normalized.lastIndexOf("/")
	return index === -1 ? "" : normalized.slice(0, index)
}

function nameOf(path: string): string {
	const normalized = normalize(path)
	return normalized.slice(normalized.lastIndexOf("/") + 1)
}

function stripMarkdown(name: string): string | null {
	return name.toLocaleLowerCase().endsWith(".md") ? name.slice(0, -3) : null
}

export function getDatabaseName(folderPath: string): string {
	return nameOf(folderPath)
}

export function getDatabaseViewNotePath(folderPath: string): string {
	const folder = normalize(folderPath)
	return `${folder}/${nameOf(folder)}.md`
}

export function getDatabaseFolder(viewNotePath: string): string {
	return parentOf(viewNotePath)
}

export function isDatabaseViewNoteCandidate(path: string): boolean {
	const parent = parentOf(path)
	if (!parent) return false
	const stem = stripMarkdown(nameOf(path))
	return stem !== null && stem === nameOf(parent)
}

export function getDatabaseRowTitle(path: string): string {
	const name = nameOf(path)
	return stripMarkdown(name) ?? name
}

export function isDatabaseRowPath(path: string, folderPath: string): boolean {
	const folder = normalize(folderPath)
	return (
		parentOf(path) === folder &&
		stripMarkdown(nameOf(path)) !== null &&
		normalize(path) !== getDatabaseViewNotePath(folder)
	)
}
