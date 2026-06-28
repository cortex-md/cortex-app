import { getPropertiesRuntime } from "./runtime"
import type { NotePropertiesUiState } from "./types"

function defaultUiState(): NotePropertiesUiState {
	return { version: 1, expanded: {} }
}

function getRelativeNotePath(vaultPath: string, filePath: string): string {
	const normalizedVault = vaultPath.replaceAll("\\", "/").replace(/\/+$/, "")
	const normalizedFile = filePath.replaceAll("\\", "/")
	return normalizedFile.startsWith(`${normalizedVault}/`)
		? normalizedFile.slice(normalizedVault.length + 1)
		: normalizedFile
}

function replacePathPrefix(path: string, oldPath: string, newPath: string): string | null {
	if (path === oldPath) return newPath
	if (!path.startsWith(`${oldPath}/`)) return null
	return `${newPath}${path.slice(oldPath.length)}`
}

async function readUiState(vaultPath: string): Promise<NotePropertiesUiState> {
	try {
		const raw = await getPropertiesRuntime().files.readFile(`${vaultPath}/.cortex/ui-state.json`)
		const parsed = JSON.parse(raw) as Partial<NotePropertiesUiState>
		return {
			version: 1,
			expanded: parsed.expanded && typeof parsed.expanded === "object" ? parsed.expanded : {},
		}
	} catch {
		return defaultUiState()
	}
}

async function writeUiState(vaultPath: string, state: NotePropertiesUiState): Promise<void> {
	await getPropertiesRuntime().files.atomicWriteFile(
		`${vaultPath}/.cortex/ui-state.json`,
		JSON.stringify(state, null, "\t"),
	)
}

export async function getNotePropertiesExpanded(
	vaultPath: string,
	filePath: string,
): Promise<boolean> {
	const state = await readUiState(vaultPath)
	return state.expanded[getRelativeNotePath(vaultPath, filePath)] ?? true
}

export async function setNotePropertiesExpanded(
	vaultPath: string,
	filePath: string,
	expanded: boolean,
): Promise<void> {
	const state = await readUiState(vaultPath)
	state.expanded[getRelativeNotePath(vaultPath, filePath)] = expanded
	await writeUiState(vaultPath, state)
}

export async function renameNotePropertiesUiState(
	vaultPath: string,
	oldFilePath: string,
	newFilePath: string,
): Promise<void> {
	const state = await readUiState(vaultPath)
	const oldPath = getRelativeNotePath(vaultPath, oldFilePath)
	const newPath = getRelativeNotePath(vaultPath, newFilePath)
	let changed = false
	for (const [path, expanded] of Object.entries(state.expanded)) {
		const nextPath = replacePathPrefix(path, oldPath, newPath)
		if (!nextPath) continue
		state.expanded[nextPath] = expanded
		delete state.expanded[path]
		changed = true
	}
	if (!changed) return
	await writeUiState(vaultPath, state)
}

export async function removeNotePropertiesUiState(
	vaultPath: string,
	filePath: string,
): Promise<void> {
	const state = await readUiState(vaultPath)
	const relativePath = getRelativeNotePath(vaultPath, filePath)
	let changed = false
	for (const path of Object.keys(state.expanded)) {
		if (path !== relativePath && !path.startsWith(`${relativePath}/`)) continue
		delete state.expanded[path]
		changed = true
	}
	if (!changed) return
	await writeUiState(vaultPath, state)
}
