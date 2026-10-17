import type { EditorConfig } from "./types"

export interface EditorConfigSettings {
	appearance: { editorFontSize: number; workspaceMode?: "full" | "writing" }
	editor: Pick<
		Required<EditorConfig>,
		"wordWrap" | "folding" | "tabSize" | "useSpaces" | "showLineNumbers" | "vimMode"
	>
}

export function createEditorConfig({ appearance, editor }: EditorConfigSettings): EditorConfig {
	return {
		fontSize: appearance.editorFontSize,
		wordWrap: editor.wordWrap,
		folding: editor.folding,
		tabSize: editor.tabSize,
		useSpaces: editor.useSpaces,
		showLineNumbers: editor.showLineNumbers && appearance.workspaceMode !== "writing",
		vimMode: editor.vimMode,
		typewriterScroll: appearance.workspaceMode === "writing",
	}
}
