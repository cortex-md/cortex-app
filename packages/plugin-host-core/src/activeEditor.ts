import { type EditorViewLike, getEditorViewRef } from "./editorViews"
import type { ActiveEditorService } from "./pluginContext"

function editActiveView(range: (view: EditorViewLike) => { from: number; to?: number }) {
	return (text: string) => {
		const view = getEditorViewRef()
		if (view) view.dispatch({ changes: { ...range(view), insert: text } })
	}
}

export function createCodeMirrorActiveEditor(
	options: Pick<ActiveEditorService, "getFilePath">,
): ActiveEditorService {
	return {
		getFilePath: () => options.getFilePath(),
		getContent: () => getEditorViewRef()?.state.doc.toString() ?? null,
		insertAtCursor: editActiveView((view) => ({ from: view.state.selection.main.from })),
		replaceSelection: editActiveView((view) => {
			const { from, to } = view.state.selection.main
			return { from, to }
		}),
	}
}
