import type { EditorRuntimeModules, EditorRuntimeStateEffectType } from "../types"

export interface LivePreviewEffects {
	livePreviewRegistryChanged: EditorRuntimeStateEffectType<void>
	toggleCalloutCollapsed: EditorRuntimeStateEffectType<string>
	hoveredCodeBlockChanged: EditorRuntimeStateEffectType<string | null>
}

export function createLivePreviewEffects(runtime: EditorRuntimeModules): LivePreviewEffects {
	return {
		livePreviewRegistryChanged: runtime.state.StateEffect.define<void>(),
		toggleCalloutCollapsed: runtime.state.StateEffect.define<string>(),
		hoveredCodeBlockChanged: runtime.state.StateEffect.define<string | null>(),
	}
}
