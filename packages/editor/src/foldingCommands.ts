import { loadEditorRuntime } from "./runtime"
import type { EditorRuntimeView } from "./types"

export async function toggleFoldAtSelection(view: EditorRuntimeView): Promise<boolean> {
	const runtime = await loadEditorRuntime()
	return runtime.language.toggleFold(view)
}

export async function unfoldCurrentFold(view: EditorRuntimeView): Promise<boolean> {
	const runtime = await loadEditorRuntime()
	return runtime.language.unfoldCode(view)
}

export async function foldAllRanges(view: EditorRuntimeView): Promise<boolean> {
	const runtime = await loadEditorRuntime()
	return runtime.language.foldAll(view)
}

export async function unfoldAllRanges(view: EditorRuntimeView): Promise<boolean> {
	const runtime = await loadEditorRuntime()
	return runtime.language.unfoldAll(view)
}
