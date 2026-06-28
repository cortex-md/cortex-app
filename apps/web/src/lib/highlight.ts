import { createHighlighterCore, type HighlighterCore, type ThemeRegistrationRaw } from "shiki/core"
import { createOnigurumaEngine } from "shiki/engine/oniguruma"
import bash from "shiki/langs/bash.mjs"
import css from "shiki/langs/css.mjs"
import html from "shiki/langs/html.mjs"
import javascript from "shiki/langs/javascript.mjs"
import json from "shiki/langs/json.mjs"
import jsonc from "shiki/langs/jsonc.mjs"
import jsx from "shiki/langs/jsx.mjs"
import markdown from "shiki/langs/markdown.mjs"
import sh from "shiki/langs/sh.mjs"
import shellscript from "shiki/langs/shellscript.mjs"
import tsx from "shiki/langs/tsx.mjs"
import typescript from "shiki/langs/typescript.mjs"
import yaml from "shiki/langs/yaml.mjs"
import githubLight from "shiki/themes/github-light.mjs"
import vitesseDark from "shiki/themes/vitesse-dark.mjs"
import vitesseLight from "shiki/themes/vitesse-light.mjs"

const CORTEX_DARK_THEME = "cortex-dark"
const CORTEX_LIGHT_THEME = "cortex-light"
const darkTokenColors = vitesseDark.settings ?? vitesseDark.tokenColors ?? []
const lightTokenColors =
	vitesseLight.settings ?? vitesseLight.tokenColors ?? githubLight.settings ?? []

const cortexDarkTheme = {
	...vitesseDark,
	name: CORTEX_DARK_THEME,
	bg: "#101010",
	fg: "#f3f3f3",
	settings: [
		...darkTokenColors,
		{
			scope: ["keyword", "storage.type", "support.type"],
			settings: { foreground: "#fb7185" },
		},
		{
			scope: ["entity.name.function", "support.function"],
			settings: { foreground: "#90b8e0" },
		},
		{
			scope: ["string", "constant.language"],
			settings: { foreground: "#7ecaa0" },
		},
		{
			scope: ["variable", "variable.parameter", "property"],
			settings: { foreground: "#dcdcdc" },
		},
		{
			scope: ["comment", "punctuation.definition.comment"],
			settings: { foreground: "#8c8c8c" },
		},
	],
} satisfies ThemeRegistrationRaw

const cortexLightTheme = {
	...vitesseLight,
	name: CORTEX_LIGHT_THEME,
	bg: "#f5f5f7",
	fg: "#303342",
	settings: [
		...lightTokenColors,
		{
			scope: ["keyword", "storage.type", "support.type"],
			settings: { foreground: "#e11d48" },
		},
		{
			scope: ["entity.name.function", "support.function"],
			settings: { foreground: "#3f6fa8" },
		},
		{
			scope: ["string", "constant.language"],
			settings: { foreground: "#3d8c68" },
		},
		{
			scope: ["variable", "variable.parameter", "property"],
			settings: { foreground: "#4d5060" },
		},
		{
			scope: ["comment", "punctuation.definition.comment"],
			settings: { foreground: "#8b8f9d" },
		},
	],
} satisfies ThemeRegistrationRaw

let highlighterPromise: Promise<HighlighterCore> | undefined

const supportedLanguages = [
	typescript,
	tsx,
	javascript,
	jsx,
	bash,
	shellscript,
	sh,
	json,
	jsonc,
	markdown,
	css,
	html,
	yaml,
]

const languageAliases = new Map<string, string>([
	["bash", "bash"],
	["console", "shellscript"],
	["css", "css"],
	["html", "html"],
	["js", "javascript"],
	["javascript", "javascript"],
	["json", "json"],
	["jsonc", "jsonc"],
	["jsx", "jsx"],
	["md", "markdown"],
	["mdx", "markdown"],
	["markdown", "markdown"],
	["shell", "shellscript"],
	["sh", "sh"],
	["tsx", "tsx"],
	["ts", "typescript"],
	["typescript", "typescript"],
	["yaml", "yaml"],
	["yml", "yaml"],
	["zsh", "shellscript"],
])

function normalizeLanguage(lang: string | undefined) {
	const normalized = lang?.trim().toLowerCase()
	if (!normalized) return "text"
	return languageAliases.get(normalized) ?? "text"
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
}

function getHighlighter() {
	highlighterPromise ??= createHighlighterCore({
		engine: createOnigurumaEngine(import("shiki/wasm")),
		langs: supportedLanguages,
		themes: [cortexDarkTheme, cortexLightTheme],
	})

	return highlighterPromise
}

export async function highlightCode(code: string, lang: "ts" | "tsx" = "tsx") {
	const highlighter = await getHighlighter()
	const html = highlighter.codeToHtml(code, {
		lang,
		theme: CORTEX_DARK_THEME,
	})

	return html
		.replace('<pre class="shiki', '<pre class="shiki cortex-shiki')
		.replace(/background-color:[^;"]+;?/u, "background-color: transparent;")
		.replace(/<\/span>\n<span class="line"/gu, '</span><span class="line"')
}

export async function highlightDocsCode(code: string, lang: string | undefined) {
	const normalizedLanguage = normalizeLanguage(lang)
	if (normalizedLanguage === "text") {
		return `<pre class="shiki cortex-shiki cortex-docs-shiki" style="background-color: transparent;"><code>${escapeHtml(
			code,
		)}</code></pre>`
	}

	const highlighter = await getHighlighter()
	const html = highlighter.codeToHtml(code, {
		lang: normalizedLanguage,
		themes: {
			light: CORTEX_LIGHT_THEME,
			dark: CORTEX_DARK_THEME,
		},
		defaultColor: false,
	})

	return html
		.replace('<pre class="shiki', '<pre class="shiki cortex-shiki cortex-docs-shiki')
		.replace(/background-color:[^;"]+;?/u, "background-color: transparent;")
		.replace(/<\/span>\n<span class="line"/gu, '</span><span class="line"')
}
