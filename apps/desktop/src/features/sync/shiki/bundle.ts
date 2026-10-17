import {
	createBundledHighlighter,
	createCssVariablesTheme,
	createSingletonShorthands,
	getTokenStyleObject,
	stringifyTokenStyle,
} from "@shikijs/core"
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript"

export * from "@shikijs/core"

export const bundledLanguages = {
	bash: () => import("@shikijs/langs/bash"),
	c: () => import("@shikijs/langs/c"),
	cpp: () => import("@shikijs/langs/cpp"),
	csharp: () => import("@shikijs/langs/csharp"),
	css: () => import("@shikijs/langs/css"),
	diff: () => import("@shikijs/langs/diff"),
	go: () => import("@shikijs/langs/go"),
	html: () => import("@shikijs/langs/html"),
	java: () => import("@shikijs/langs/java"),
	javascript: () => import("@shikijs/langs/javascript"),
	json: () => import("@shikijs/langs/json"),
	jsx: () => import("@shikijs/langs/jsx"),
	markdown: () => import("@shikijs/langs/markdown"),
	python: () => import("@shikijs/langs/python"),
	rust: () => import("@shikijs/langs/rust"),
	shellscript: () => import("@shikijs/langs/shellscript"),
	sql: () => import("@shikijs/langs/sql"),
	toml: () => import("@shikijs/langs/toml"),
	tsx: () => import("@shikijs/langs/tsx"),
	typescript: () => import("@shikijs/langs/typescript"),
	xml: () => import("@shikijs/langs/xml"),
	yaml: () => import("@shikijs/langs/yaml"),
}

export const bundledThemes = {}

export const createHighlighter = createBundledHighlighter({
	langs: bundledLanguages,
	themes: bundledThemes,
	engine: () => createJavaScriptRegexEngine({ forgiving: true }),
})

export const { codeToHtml } = createSingletonShorthands(createHighlighter)

export function createOnigurumaEngine() {
	return createJavaScriptRegexEngine({ forgiving: true })
}

export {
	createCssVariablesTheme,
	createJavaScriptRegexEngine,
	getTokenStyleObject,
	stringifyTokenStyle,
}
