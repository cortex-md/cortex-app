import type { LanguageSupport } from "@codemirror/language"

export interface CodeLanguagePack {
	name: string
	alias: string[]
	load: () => Promise<LanguageSupport>
}

const javascript = (options?: { jsx?: boolean; typescript?: boolean }) =>
	import("@codemirror/lang-javascript").then((module) => module.javascript(options))

export const codeLanguagePacks: CodeLanguagePack[] = [
	{ name: "JavaScript", alias: ["js", "javascript"], load: () => javascript() },
	{ name: "TypeScript", alias: ["ts", "typescript"], load: () => javascript({ typescript: true }) },
	{ name: "JSX", alias: ["jsx"], load: () => javascript({ jsx: true }) },
	{ name: "TSX", alias: ["tsx"], load: () => javascript({ jsx: true, typescript: true }) },
	{
		name: "Python",
		alias: ["py", "python"],
		load: () => import("@codemirror/lang-python").then((module) => module.python()),
	},
	{
		name: "Rust",
		alias: ["rs", "rust"],
		load: () => import("@codemirror/lang-rust").then((module) => module.rust()),
	},
	{
		name: "HTML",
		alias: ["html"],
		load: () => import("@codemirror/lang-html").then((module) => module.html()),
	},
	{
		name: "CSS",
		alias: ["css"],
		load: () => import("@codemirror/lang-css").then((module) => module.css()),
	},
	{
		name: "JSON",
		alias: ["json"],
		load: () => import("@codemirror/lang-json").then((module) => module.json()),
	},
	{
		name: "YAML",
		alias: ["yml", "yaml"],
		load: () => import("@codemirror/lang-yaml").then((module) => module.yaml()),
	},
	{
		name: "SQL",
		alias: ["sql"],
		load: () => import("@codemirror/lang-sql").then((module) => module.sql()),
	},
]

export function findCodeLanguagePack(lang: string): CodeLanguagePack | null {
	const key = lang.toLowerCase()
	return (
		codeLanguagePacks.find((pack) => pack.name.toLowerCase() === key || pack.alias.includes(key)) ??
		null
	)
}
