import { loadEditorRuntime } from "./runtime"
import type { EditorRuntimeModules } from "./types"

function createLanguageMap(runtime: EditorRuntimeModules): Record<string, () => unknown> {
	return {
		javascript: () => runtime.langJavascript.javascript(),
		js: () => runtime.langJavascript.javascript(),
		typescript: () => runtime.langJavascript.javascript({ typescript: true }),
		ts: () => runtime.langJavascript.javascript({ typescript: true }),
		jsx: () => runtime.langJavascript.javascript({ jsx: true }),
		tsx: () => runtime.langJavascript.javascript({ jsx: true, typescript: true }),
		python: () => runtime.langPython.python(),
		py: () => runtime.langPython.python(),
		rust: () => runtime.langRust.rust(),
		rs: () => runtime.langRust.rust(),
		html: () => runtime.langHtml.html(),
		css: () => runtime.langCss.css(),
		json: () => runtime.langJson.json(),
		yaml: () => runtime.langYaml.yaml(),
		yml: () => runtime.langYaml.yaml(),
		sql: () => runtime.langSql.sql(),
	}
}

export async function getLanguageSupport(lang: string): Promise<unknown | null> {
	const runtime = await loadEditorRuntime()
	const factory = createLanguageMap(runtime)[lang.toLowerCase()]
	return factory ? factory() : null
}
