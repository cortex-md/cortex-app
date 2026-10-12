import { createCoreServices } from "@cortex/core"
import { pluginEditorRuntime } from "@cortex/editor/extensions"
import { loadCodeMirrorCommunityPluginExternals } from "@cortex/editor/runtime"
import { createCodeMirrorActiveEditor, createPluginHost } from "@cortex/plugin-host-core"
import { useSettingsStore } from "@cortex/settings"
import { getThemeManager } from "@cortex/theme"
import { webPluginMarkdownStyleHost } from "../features/plugins/pluginMarkdownStyleHost"

const coreServices = createCoreServices()

export const pluginHost = createPluginHost({
	...coreServices,
	activeEditor: createCodeMirrorActiveEditor(coreServices.activeEditor),
	editorRuntime: pluginEditorRuntime,
	theme: {
		getActiveThemeName: () => getThemeManager().getActiveTheme().name,
		subscribe: (callback) => getThemeManager().subscribe((theme) => callback(theme.name)),
	},
	community: {
		styles: webPluginMarkdownStyleHost,
		loadEditorExternals: loadCodeMirrorCommunityPluginExternals,
		isAllowed: () => useSettingsStore.getState().settings.plugins.allowCommunity,
	},
})
