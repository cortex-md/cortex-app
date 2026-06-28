import type {
	Disposable,
	PluginAPI,
	WorkspaceMarkdownTab,
	WorkspaceOpenOptions,
} from "@cortex.md/api"
import { requirePluginCapability } from "../manifestCapabilities"

type OpenFileFn = (path: string, options?: WorkspaceOpenOptions) => void
type OpenViewFn = (pluginId: string, viewId: string, options?: WorkspaceOpenOptions) => void
type OpenMarkdownTabFn = (
	pluginId: string,
	tab: WorkspaceMarkdownTab,
	options?: WorkspaceOpenOptions,
) => void
type GetOpenFilesFn = () => string[]
type SubscribeActiveFileFn = (callback: (path: string | null) => void) => () => void

let openFileFn: OpenFileFn | null = null
let openViewFn: OpenViewFn | null = null
let openMarkdownTabFn: OpenMarkdownTabFn | null = null
let getOpenFilesFn: GetOpenFilesFn | null = null
let subscribeActiveFileFn: SubscribeActiveFileFn | null = null

export function setWorkspaceFunctions(fns: {
	openFile: OpenFileFn
	openView: OpenViewFn
	openMarkdownTab: OpenMarkdownTabFn
	getOpenFiles: GetOpenFilesFn
	subscribeActiveFile: SubscribeActiveFileFn
}): void {
	openFileFn = fns.openFile
	openViewFn = fns.openView
	openMarkdownTabFn = fns.openMarkdownTab
	getOpenFilesFn = fns.getOpenFiles
	subscribeActiveFileFn = fns.subscribeActiveFile
}

export function createWorkspaceAPI(pluginId: string): PluginAPI["workspace"] {
	return {
		openFile(path: string, options?: WorkspaceOpenOptions): void {
			requirePluginCapability(pluginId, "workspace:tabs")
			openFileFn?.(path, options)
		},

		openView(viewId: string, options?: WorkspaceOpenOptions): void {
			requirePluginCapability(pluginId, "workspace:tabs")
			requirePluginCapability(pluginId, "ui:views")
			openViewFn?.(pluginId, viewId, options)
		},

		openMarkdownTab(tab: WorkspaceMarkdownTab, options?: WorkspaceOpenOptions): void {
			requirePluginCapability(pluginId, "workspace:tabs")
			requirePluginCapability(pluginId, "ui:views")
			openMarkdownTabFn?.(pluginId, tab, options)
		},

		getOpenFiles(): string[] {
			requirePluginCapability(pluginId, "workspace:tabs")
			return getOpenFilesFn?.() ?? []
		},

		onActiveFileChange(callback: (path: string | null) => void): Disposable {
			requirePluginCapability(pluginId, "workspace:tabs")
			if (!subscribeActiveFileFn) return { dispose() {} }
			const unsubscribe = subscribeActiveFileFn(callback)
			return { dispose: unsubscribe }
		},
	}
}
