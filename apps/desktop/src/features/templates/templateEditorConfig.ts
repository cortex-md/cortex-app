import type { EditorConfig } from "@cortex/editor/types"
import type { AppSettings } from "@cortex/settings"

export function createTemplateEditorConfig(settings: AppSettings): EditorConfig {
	return {
		fontSize: settings.appearance.editorFontSize,
		wordWrap: settings.editor.wordWrap,
		folding: settings.editor.folding,
		tabSize: settings.editor.tabSize,
		useSpaces: settings.editor.useSpaces,
		showLineNumbers: settings.editor.showLineNumbers,
		vimMode: settings.editor.vimMode,
	}
}
