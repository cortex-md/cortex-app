import { loadEditorRuntime } from "./runtime"
import type { EditorRuntimeView } from "./types"

export async function revealLine(view: EditorRuntimeView, line: number): Promise<boolean> {
	const runtime = await loadEditorRuntime()
	const lineNumber = Math.min(Math.max(1, line + 1), view.state.doc.lines)
	const position = view.state.doc.line(lineNumber).from
	view.dispatch({
		selection: { anchor: position },
		effects: runtime.view.EditorView.scrollIntoView(position, { y: "start", yMargin: 48 }),
	})
	view.focus()
	return true
}
