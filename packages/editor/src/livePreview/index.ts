import "./styles.css"
import type { CodeBlockEmbedDefinition } from "../codeBlockEmbeds"
import type { EditorRuntimeModules } from "../types"
import { createLivePreviewBlockField } from "./blockState"
import { createLivePreviewEffects } from "./effects"
import { createVisibleDecorationsPlugin } from "./visibleDecorations"
import { createLivePreviewWidgets } from "./widgets"

export function livePreviewExtension(
	runtime: EditorRuntimeModules,
	resolveImageUrl?: (src: string, filePath: string) => string,
	filePath?: string,
	codeBlockEmbeds?: readonly CodeBlockEmbedDefinition[],
) {
	const imageResolver = resolveImageUrl ?? ((src) => src)
	const currentFilePath = filePath ?? ""
	const effects = createLivePreviewEffects(runtime)
	const widgets = createLivePreviewWidgets(runtime, effects)
	const blockField = createLivePreviewBlockField(
		runtime,
		effects,
		widgets,
		imageResolver,
		currentFilePath,
		codeBlockEmbeds,
	)

	return [
		runtime.view.EditorView.editorAttributes.of({ class: "markdown-surface" }),
		blockField,
		createVisibleDecorationsPlugin(
			runtime,
			effects,
			widgets,
			blockField,
			codeBlockEmbeds,
			currentFilePath,
		),
	]
}

export { getLivePreviewMetrics, resetLivePreviewMetrics } from "./metrics"
