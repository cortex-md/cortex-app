import type { Plugin } from "unified"
import { sanitizeMarkdownUrl } from "../urlPolicy"

interface HastNode {
	type: string
	tagName?: string
	properties?: Record<string, unknown>
	children?: HastNode[]
}

function applyUrlPolicy(node: HastNode): void {
	if (node.type === "element" && node.properties) {
		const href = node.properties.href
		if (typeof href === "string") {
			const sanitizedHref = sanitizeMarkdownUrl(href, "link")
			if (sanitizedHref) node.properties.href = sanitizedHref
			else delete node.properties.href
		}

		const src = node.properties.src
		if (typeof src === "string") {
			const sanitizedSrc = sanitizeMarkdownUrl(src, "image")
			if (node.tagName === "img" && sanitizedSrc) node.properties.src = sanitizedSrc
			else delete node.properties.src
		}

		delete node.properties.srcSet
		delete node.properties.xLinkHref
	}

	for (const child of node.children ?? []) applyUrlPolicy(child)
}

export const rehypeMarkdownUrlPolicy: Plugin = () => {
	return (tree) => {
		applyUrlPolicy(tree as HastNode)
	}
}
