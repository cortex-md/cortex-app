import { loadEditorRuntime } from "@cortex/editor/runtime"
import { reconfigurePluginExtensions } from "@cortex/editor/extensions"
import type { EditorRuntimeView } from "@cortex/editor/types"
import {
	enablePlugin,
	pluginStore,
	registerBundledPlugin,
	setEditorContextFunctions,
	setEditorViewRef,
	setReconfigurePluginExtensions,
} from "@cortex/plugin-host-core"
import { CortexPlugin } from "@cortex.md/api"

interface MobileEditorPluginHostOptions {
	getActiveFileContent: () => string | null
	getActiveFilePath: () => string | null
	getVaultPath: () => string | null
}

const fixturePluginId = "mobile-editor-extension-fixture"
let initialized = false
let fixtureEnablePromise: Promise<void> | null = null

export function initializeMobileEditorPluginHost(options: MobileEditorPluginHostOptions): void {
	setReconfigurePluginExtensions(reconfigurePluginExtensions as never)
	setEditorContextFunctions({
		getActiveFileContent: options.getActiveFileContent,
		getActiveFilePath: options.getActiveFilePath,
	})

	if (!initialized) {
		initialized = true
		registerBundledPlugin(
			{
				id: fixturePluginId,
				name: "Mobile Editor Extension Fixture",
				version: "0.1.0",
				minAppVersion: "0.1.0",
				author: "Cortex",
				description: "Validates CodeMirror editor extensions inside the mobile DOM editor.",
				icon: "edit-3",
				main: "index.ts",
				capabilities: ["editor:extensions"],
			},
			{ default: MobileEditorExtensionFixturePlugin },
		)
	}

	fixtureEnablePromise ??= enablePlugin(fixturePluginId, options.getVaultPath).catch((error) => {
		pluginStore.getState().setPluginStatus(fixturePluginId, "error", String(error))
		throw error
	})
}

export function setMobileEditorPluginView(view: EditorRuntimeView | null): void {
	setEditorViewRef(view as never)
}

class MobileEditorExtensionFixturePlugin extends CortexPlugin {
	async onload() {
		const runtime = await loadEditorRuntime()
		this.registerEditorExtension(
			runtime.view.EditorView.theme({
				".cm-content": {
					caretColor: "var(--editor-caret-color, var(--accent-color, currentColor))",
				},
				".cm-editor.mobile-editor-plugin-fixture": {
					outline: "none",
				},
			}),
		)
		this.registerEditorExtension(
			runtime.view.EditorView.editorAttributes.of({
				class: "mobile-editor-plugin-fixture",
			}),
		)
	}
}
