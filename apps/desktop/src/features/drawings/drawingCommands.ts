import type { EditorRuntimeView } from "@cortex/editor/types"
import { createDrawingFence, createEmptyDrawingDocument } from "./drawingDocument"
import { openDrawingModal } from "./drawingModalStore"

function needsLeadingBreak(view: EditorRuntimeView, from: number): boolean {
	if (from === 0) return false
	const previous = view.state.sliceDoc(Math.max(0, from - 1), from)
	return previous !== "\n"
}

function needsTrailingBreak(view: EditorRuntimeView, to: number): boolean {
	if (to >= view.state.doc.length) return false
	const next = view.state.sliceDoc(to, Math.min(view.state.doc.length, to + 1))
	return next !== "\n"
}

export function insertDrawingBlock(view: EditorRuntimeView, filePath: string | null): boolean {
	if (!filePath) return false
	const document = createEmptyDrawingDocument()
	const { from, to } = view.state.selection.main
	const leadingBreak = needsLeadingBreak(view, from) ? "\n\n" : ""
	const trailingBreak = needsTrailingBreak(view, to) ? "\n\n" : "\n"
	const insertion = `${leadingBreak}${createDrawingFence(document)}${trailingBreak}`

	view.dispatch({
		changes: { from, to, insert: insertion },
		selection: { anchor: from + insertion.length },
	})
	openDrawingModal({ filePath, drawingId: document.id })
	return true
}
