import type { EditorConfig } from "@cortex/editor/types"

export interface MobileEditorConfig extends EditorConfig {
	readOnly: boolean
	livePreview: boolean
	slashCommands: boolean
}
