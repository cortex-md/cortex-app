import { loadEditorRuntime } from "./runtime"
import type { EditorRuntimeView } from "./types"

export async function openFindPanel(view: EditorRuntimeView): Promise<boolean> {
	const runtime = await loadEditorRuntime()
	runtime.search.openSearchPanel(view)
	return true
}
