import type { Plugin } from "unified"
import { getRendererFeatureFlags } from "../features"

interface HastNode {
	type: string
	value?: string
	tagName?: string
	properties?: Record<string, unknown>
	children?: HastNode[]
}

const SHELL_LANGUAGES = new Set(["sh", "bash", "shell", "zsh", "console", "terminal"])
const COPY_ICON_PATHS = [
	"M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z",
	"M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2",
]

function getLanguage(code: HastNode | undefined): string | null {
	const classes = code?.properties?.className
	if (!Array.isArray(classes)) return null
	for (const className of classes) {
		if (typeof className === "string" && className.startsWith("language-")) {
			return className.slice("language-".length).toLowerCase()
		}
	}
	return null
}

function createChrome(language: string | null): HastNode {
	return {
		type: "element",
		tagName: "div",
		properties: { className: ["markdown-code-chrome"] },
		children: [
			...(language
				? [
						{
							type: "element",
							tagName: "span",
							properties: { className: ["markdown-code-language"] },
							children: [{ type: "text", value: language }],
						},
					]
				: []),
			{
				type: "element",
				tagName: "button",
				properties: {
					className: ["markdown-code-copy"],
					type: "button",
					"data-code-copy": "",
					ariaLabel: "Copy",
					title: "Copy",
				},
				children: [
					{
						type: "element",
						tagName: "svg",
						properties: {
							viewBox: "0 0 24 24",
							ariaHidden: "true",
							className: ["markdown-code-icon"],
						},
						children: COPY_ICON_PATHS.map((d) => ({
							type: "element",
							tagName: "path",
							properties: { d },
							children: [],
						})),
					},
				],
			},
		],
	}
}

function wrapCodeBlocks(node: HastNode): void {
	const children = node.children
	if (!children) return
	for (let index = 0; index < children.length; index++) {
		const child = children[index] as HastNode
		if (child.type !== "element") continue
		if (child.tagName === "pre") {
			const code = child.children?.find((item) => item.tagName === "code")
			const language = getLanguage(code)
			const className = ["markdown-code-block"]
			if (language && SHELL_LANGUAGES.has(language)) className.push("is-shell")
			if (language === "diff") className.push("is-diff")
			children[index] = {
				type: "element",
				tagName: "div",
				properties: { className },
				children: [createChrome(language), child],
			}
			continue
		}
		wrapCodeBlocks(child)
	}
}

export const rehypeCodeChrome: Plugin = () => {
	return (tree, file) => {
		if (!getRendererFeatureFlags(file).hasCodeBlocks) return
		wrapCodeBlocks(tree as HastNode)
	}
}
