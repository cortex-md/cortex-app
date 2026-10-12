import { countWords } from "@cortex/search"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { noteCache } from "../noteCache"
import { extractHeadings, type NoteHeading } from "../notes/outline"

export type EditorMode = "source" | "live-preview" | "reading" | "side-by-side"

export interface CursorPosition {
	line: number
	col: number
	offset: number
}

export interface DocumentOverview {
	filePath: string
	words: number
	headings: NoteHeading[]
}

export interface EditorRevealRequest {
	filePath: string
	line: number
	requestId: number
}

export interface EditorState {
	activeFilePath: string | null
	mode: EditorMode
	cursor: CursorPosition | null
	document: DocumentOverview | null
	revealRequest: EditorRevealRequest | null

	setActiveFile: (filePath: string | null) => void
	updateCursor: (cursor: CursorPosition) => void
	updateDocument: (filePath: string, body: string) => void
	requestReveal: (filePath: string, line: number) => void
	clearReveal: (requestId: number) => void
	setMode: (mode: EditorMode) => void
	flushActive: () => Promise<void>
}

export const useEditorStore = create<EditorState>()(
	devtools(
		immer((set, get) => ({
			activeFilePath: null,
			mode: "live-preview" as EditorMode,
			cursor: null,
			document: null,
			revealRequest: null,

			setActiveFile: (filePath) => {
				set((s) => {
					s.activeFilePath = filePath
					s.cursor = null
				})
			},

			requestReveal: (filePath, line) => {
				set((s) => {
					s.revealRequest = { filePath, line, requestId: (s.revealRequest?.requestId ?? 0) + 1 }
				})
			},

			clearReveal: (requestId) => {
				set((s) => {
					if (s.revealRequest?.requestId === requestId) s.revealRequest = null
				})
			},

			updateDocument: (filePath, body) => {
				const overview = { filePath, words: countWords(body), headings: extractHeadings(body) }
				set((s) => {
					s.document = overview
				})
			},

			updateCursor: (cursor) => {
				set((s) => {
					s.cursor = cursor
				})
			},

			setMode: (mode) => {
				set((s) => {
					s.mode = mode
				})
			},

			flushActive: async () => {
				const { activeFilePath } = get()
				if (activeFilePath) {
					await noteCache.flush(activeFilePath)
				}
			},
		})),
		{ name: "editorStore" },
	),
)

export function selectActiveDocument(state: EditorState): DocumentOverview | null {
	return state.document && state.document.filePath === state.activeFilePath ? state.document : null
}
