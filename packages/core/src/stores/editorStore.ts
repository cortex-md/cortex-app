import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { noteCache } from "../noteCache"

export type EditorMode = "source" | "live-preview" | "reading" | "side-by-side"

export interface CursorPosition {
	line: number
	col: number
	offset: number
}

export interface EditorState {
	activeFilePath: string | null
	mode: EditorMode
	cursor: CursorPosition | null

	setActiveFile: (filePath: string | null) => void
	updateCursor: (cursor: CursorPosition) => void
	setMode: (mode: EditorMode) => void
	flushActive: () => Promise<void>
}

export const useEditorStore = create<EditorState>()(
	devtools(
		immer((set, get) => ({
			activeFilePath: null,
			mode: "live-preview" as EditorMode,
			cursor: null,

			setActiveFile: (filePath) => {
				set((s) => {
					s.activeFilePath = filePath
					s.cursor = null
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
