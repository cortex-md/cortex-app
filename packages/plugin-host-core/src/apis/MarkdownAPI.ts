import {
	registerCalloutType,
	registerMarkdownInline,
	registerMarkdownPreprocessor,
	registerMarkdownProcessor,
	registerMarkdownSemantic,
} from "@cortex/renderer"
import type { Disposable, PluginAPI } from "@cortex.md/api"
import { requirePluginCapability } from "../manifestCapabilities"

export function createMarkdownAPI(pluginId: string): PluginAPI["markdown"] {
	return {
		registerInline(registration): Disposable {
			requirePluginCapability(pluginId, "markdown:extensions")
			const dispose = registerMarkdownInline(registration, pluginId)
			return { dispose }
		},
		registerSemantic(registration): Disposable {
			requirePluginCapability(pluginId, "markdown:extensions")
			const dispose = registerMarkdownSemantic(registration, pluginId)
			return { dispose }
		},
		registerPreprocessor(preprocessor): Disposable {
			requirePluginCapability(pluginId, "markdown:extensions")
			const dispose = registerMarkdownPreprocessor(preprocessor, pluginId)
			return { dispose }
		},
		registerProcessor(processor): Disposable {
			requirePluginCapability(pluginId, "markdown:extensions")
			const dispose = registerMarkdownProcessor(processor, pluginId)
			return { dispose }
		},
		registerCalloutType(registration): Disposable {
			requirePluginCapability(pluginId, "markdown:extensions")
			const dispose = registerCalloutType(registration, pluginId)
			return { dispose }
		},
	}
}
