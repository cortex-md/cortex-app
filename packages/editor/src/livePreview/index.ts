import "./styles.css"
import type { EditorRuntimeModules } from "../types"
import { createLivePreviewBlockField } from "./blockState"
import { createLivePreviewEffects } from "./effects"
import { createVisibleDecorationsPlugin } from "./visibleDecorations"
import { createLivePreviewWidgets } from "./widgets"

export function livePreviewExtension(
	runtime: EditorRuntimeModules,
	resolveImageUrl?: (src: string, filePath: string) => string,
	filePath?: string,
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
	)

	return [
		runtime.view.EditorView.editorAttributes.of({ class: "markdown-surface" }),
		blockField,
		createVisibleDecorationsPlugin(runtime, effects, widgets, blockField),
	]
}

export { getLivePreviewMetrics, resetLivePreviewMetrics } from "./metrics"
