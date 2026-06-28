import { setPluginMarkdownStyleHost } from "@cortex/plugin-host-core"

const pluginStyleElements = new Map<string, HTMLStyleElement>()

export function installWebPluginMarkdownStyleHost(): void {
	setPluginMarkdownStyleHost({
		install(pluginId, css) {
			removePluginMarkdownStyle(pluginId)
			if (!css || typeof document === "undefined") return

			const style = document.createElement("style")
			style.dataset.cortexPluginStyle = pluginId
			style.textContent = css
			document.head.appendChild(style)
			pluginStyleElements.set(pluginId, style)
		},
		remove: removePluginMarkdownStyle,
	})
}

function removePluginMarkdownStyle(pluginId: string): void {
	pluginStyleElements.get(pluginId)?.remove()
	pluginStyleElements.delete(pluginId)
}
