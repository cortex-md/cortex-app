import type { EditorRuntimeModules } from "./types"

let editorRuntimePromise: Promise<EditorRuntimeModules> | null = null

export function loadEditorRuntime(): Promise<EditorRuntimeModules> {
	editorRuntimePromise ??= Promise.all([
		import("@codemirror/autocomplete"),
		import("@codemirror/commands"),
		import("@codemirror/lang-css"),
		import("@codemirror/lang-html"),
		import("@codemirror/lang-javascript"),
		import("@codemirror/lang-json"),
		import("@codemirror/lang-markdown"),
		import("@codemirror/lang-python"),
		import("@codemirror/lang-rust"),
		import("@codemirror/lang-sql"),
		import("@codemirror/lang-yaml"),
		import("@codemirror/language"),
		import("@codemirror/search"),
		import("@codemirror/state"),
		import("@codemirror/view"),
		import("@lezer/highlight"),
		import("@lezer/markdown"),
		import("@replit/codemirror-vim"),
	]).then(
		([
			autocomplete,
			commands,
			langCss,
			langHtml,
			langJavascript,
			langJson,
			langMarkdown,
			langPython,
			langRust,
			langSql,
			langYaml,
			language,
			search,
			state,
			view,
			lezerHighlight,
			lezerMarkdown,
			vim,
		]) => ({
			autocomplete,
			commands,
			langCss,
			langHtml,
			langJavascript,
			langJson,
			langMarkdown,
			langPython,
			langRust,
			langSql,
			langYaml,
			language,
			search,
			state,
			view,
			lezerHighlight,
			lezerMarkdown,
			vim,
		}),
	)

	return editorRuntimePromise
}

export async function loadCodeMirrorCommunityPluginExternals(): Promise<Record<string, unknown>> {
	const runtime = await loadEditorRuntime()
	return {
		"@codemirror/state": runtime.state,
		"@codemirror/view": runtime.view,
	}
}
