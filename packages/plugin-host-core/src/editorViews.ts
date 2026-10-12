export interface EditorViewLike {
	dispatch(spec: { changes: { from: number; to?: number; insert: string } }): void
	state: {
		doc: { toString(): string }
		selection: { main: { from: number; to: number } }
	}
}

type EditorViewListener = (view: EditorViewLike) => void

const knownViews = new Set<EditorViewLike>()
const viewListeners = new Set<EditorViewListener>()
let activeView: EditorViewLike | null = null

function isDestroyed(view: EditorViewLike): boolean {
	return (view as { destroyed?: boolean }).destroyed === true
}

export function registerEditorView(view: EditorViewLike): void {
	if (knownViews.has(view)) return
	knownViews.add(view)
	for (const listener of viewListeners) listener(view)
}

export function setEditorViewRef(view: EditorViewLike | null): void {
	if (view === activeView) return
	activeView = view
	if (view) registerEditorView(view)
}

export function getEditorViewRef(): EditorViewLike | null {
	return activeView
}

export function getOpenEditorViews(): EditorViewLike[] {
	for (const view of knownViews) {
		if (isDestroyed(view)) knownViews.delete(view)
	}
	return Array.from(knownViews)
}

export function onEditorViewAdded(listener: EditorViewListener): () => void {
	viewListeners.add(listener)
	return () => viewListeners.delete(listener)
}
