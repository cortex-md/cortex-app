import type { EditorRuntimeModules } from "./types"

let editorRuntimePromise: Promise<EditorRuntimeModules> | null = null

export function loadEditorRuntime(): Promise<EditorRuntimeModules> {
	editorRuntimePromise ??= Promise.all([
		import("@codemirror/autocomplete"),
		import("@codemirror/commands"),
		import("@codemirror/lang-markdown"),
		import("@codemirror/language"),
		import("@codemirror/search"),
		import("@codemirror/state"),
		import("@codemirror/view"),
		import("@lezer/highlight"),
		import("@lezer/markdown"),
	]).then(
		([
			autocomplete,
			commands,
			langMarkdown,
			language,
			search,
			state,
			view,
			lezerHighlight,
			lezerMarkdown,
		]) => ({
			autocomplete,
			commands,
			langMarkdown,
			language,
			search,
			state,
			view,
			lezerHighlight,
			lezerMarkdown,
			vim: null,
		}),
	)

	return editorRuntimePromise
}

let vimRuntimePromise: Promise<void> | null = null

export function loadVimRuntime(): Promise<void> {
	vimRuntimePromise ??= Promise.all([loadEditorRuntime(), import("@replit/codemirror-vim")]).then(
		([runtime, vim]) => {
			runtime.vim = vim
		},
	)
	return vimRuntimePromise
}

export async function loadCodeMirrorCommunityPluginExternals(): Promise<Record<string, unknown>> {
	const runtime = await loadEditorRuntime()
	return {
		"@codemirror/state": runtime.state,
		"@codemirror/view": runtime.view,
	}
}
