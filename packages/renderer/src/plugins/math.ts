import { fromHtml } from "hast-util-from-html"
import type { Plugin } from "unified"
import { visit } from "unist-util-visit"
import { renderMathExpression } from "../mathRender"
import { scanInlineMath } from "../mathSyntax"

interface HastNode {
	type: string
	tagName?: string
	value?: string
	properties?: Record<string, unknown>
	children?: HastNode[]
}

interface HastParent extends HastNode {
	children: HastNode[]
}

function classNames(node: HastNode): string[] {
	const className = node.properties?.className
	if (Array.isArray(className))
		return className.filter((value): value is string => typeof value === "string")
	if (typeof className === "string") return className.split(/\s+/)
	return []
}

function nodeText(node: HastNode): string {
	if (node.type === "text") return node.value ?? ""
	return node.children?.map((child) => nodeText(child)).join("") ?? ""
}

function parseMathHtml(html: string): HastNode[] {
	const root = fromHtml(html, { fragment: true }) as HastParent
	return root.children ?? []
}

async function renderMathNode(source: string, displayMode: "inline" | "block"): Promise<HastNode> {
	const result = await renderMathExpression({ source, displayMode })
	const children = parseMathHtml(result.html)
	return {
		type: "element",
		tagName: displayMode === "block" ? "div" : "span",
		properties: {
			className: [
				displayMode === "block" ? "markdown-math-block" : "markdown-math-inline",
				...(result.status === "error" ? ["markdown-math-error"] : []),
			],
			...(result.message ? { title: result.message } : {}),
		},
		children,
	}
}

function replaceNode(parent: HastParent, index: number | undefined, replacement: HastNode): void {
	if (typeof index !== "number") return
	parent.children.splice(index, 1, replacement)
}

function isMathCodeNode(node: HastNode): "inline" | "block" | null {
	if (node.type !== "element" || node.tagName !== "code") return null
	const classes = classNames(node)
	if (!classes.includes("language-math")) return null
	if (classes.includes("math-display")) return "block"
	return classes.includes("math-inline") ? "inline" : null
}

function isDisplayMathPre(node: HastNode): boolean {
	if (node.type !== "element" || node.tagName !== "pre") return false
	const firstChild = node.children?.[0]
	return firstChild ? isMathCodeNode(firstChild) === "block" : false
}

export function rehypeCortexMath(): ReturnType<Plugin> {
	return async (tree) => {
		const pending: Promise<void>[] = []

		visit(tree as HastNode, "element", (node: HastNode, index, parent: HastParent | undefined) => {
			if (!parent) return
			if (isDisplayMathPre(node)) {
				const code = node.children?.[0]
				if (!code) return
				pending.push(
					renderMathNode(nodeText(code), "block").then((replacement) => {
						replaceNode(parent, index, replacement)
					}),
				)
				return
			}

			const displayMode = isMathCodeNode(node)
			if (!displayMode) return
			pending.push(
				renderMathNode(nodeText(node), displayMode).then((replacement) => {
					replaceNode(parent, index, replacement)
				}),
			)
		})

		await Promise.all(pending)
		return tree
	}
}

export function remarkCortexInlineMath(): ReturnType<Plugin> {
	return (tree) => {
		visit(tree as HastNode, "text", (node: HastNode, index, parent: HastParent | undefined) => {
			if (!parent || typeof index !== "number" || typeof node.value !== "string") return
			if (parent.type === "link" || parent.type === "linkReference") return
			const tokens = scanInlineMath(node.value)
			if (tokens.length === 0) return

			const replacement: HastNode[] = []
			let cursor = 0
			for (const token of tokens) {
				if (cursor < token.from) {
					replacement.push({ type: "text", value: node.value.slice(cursor, token.from) })
				}
				replacement.push({
					type: "inlineMath",
					value: token.content,
					data: {
						hName: "code",
						hProperties: { className: ["language-math", "math-inline"] },
						hChildren: [{ type: "text", value: token.content }],
					},
				} as HastNode)
				cursor = token.to
			}
			if (cursor < node.value.length) {
				replacement.push({ type: "text", value: node.value.slice(cursor) })
			}
			parent.children.splice(index, 1, ...replacement)
			return index + replacement.length
		})
		return tree
	}
}
