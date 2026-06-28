import type { Plugin } from "unified"
import { visit } from "unist-util-visit"
import { getRendererFeatureFlags } from "../features"

const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

type HastNode = {
	type: string
	value?: string
	tagName?: string
	properties?: Record<string, unknown>
	children?: HastNode[]
}

export const rehypeWikiLinks: Plugin = () => {
	return (tree, file) => {
		if (!getRendererFeatureFlags(file).hasWikiLinks) return
		visit(tree, "text", (node: HastNode, index, parent) => {
			if (!node.value?.includes("[[")) return
			if (!parent || index === undefined) return

			const parts: HastNode[] = []
			let lastIndex = 0

			WIKI_LINK_PATTERN.lastIndex = 0

			for (const match of node.value.matchAll(WIKI_LINK_PATTERN)) {
				if (match.index > lastIndex) {
					parts.push({ type: "text", value: node.value.slice(lastIndex, match.index) })
				}

				const target = match[1].trim()
				const label = match[2]?.trim() ?? target

				parts.push({
					type: "element",
					tagName: "a",
					properties: { "data-wiki-link": target, href: "#" },
					children: [{ type: "text", value: label }],
				})

				lastIndex = match.index + match[0].length
			}

			if (parts.length === 0) return

			if (lastIndex < node.value.length) {
				parts.push({ type: "text", value: node.value.slice(lastIndex) })
			}

			const parentNode = parent as unknown as { children: unknown[] }
			parentNode.children.splice(index, 1, ...parts)
		})
	}
}
