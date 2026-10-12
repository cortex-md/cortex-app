import type { CodeBlockEmbedDefinition } from "@cortex/editor/code-block-embeds"
import { createEditorConfig } from "@cortex/editor/editor-config"
import { resolveNoteAssetPath } from "@cortex/editor/note-assets"
import type { EditorConfig } from "@cortex/editor/types"
import { getPlatform } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { useMemo } from "react"
import { createDrawingCodeBlockEmbed } from "../drawings/drawingCodeBlockEmbed"
import { createMermaidCodeBlockEmbed } from "../mermaid/mermaidCodeBlockEmbed"

export function createNoteCodeBlockEmbeds(filePath: string): CodeBlockEmbedDefinition[] {
	return [createDrawingCodeBlockEmbed(filePath), createMermaidCodeBlockEmbed(filePath)]
}

export function resolveNoteImageUrl(src: string, currentFilePath: string): string {
	const asset = resolveNoteAssetPath(src, currentFilePath)
	return asset.kind === "url" ? asset.value : getPlatform().app.resolveFileAssetUrl(asset.value)
}

export function useEditorConfig(): EditorConfig {
	const editorFontSize = useSettingsStore((s) => s.settings.appearance.editorFontSize)
	const editor = useSettingsStore((s) => s.settings.editor)
	return useMemo(
		() => createEditorConfig({ appearance: { editorFontSize }, editor }),
		[editorFontSize, editor],
	)
}
