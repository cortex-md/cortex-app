import type { Plugin } from "unified"
import { getRendererFeatureFlags } from "../features"
import {
	getMarkdownTextTransforms,
	type MarkdownPortableNode,
	type MarkdownSemanticSurface,
} from "../registry"
import { sanitizeMarkdownUrl } from "../urlPolicy"

interface HastNode {
	type: string
	value?: string
	tagName?: string
	properties?: Record<string, unknown>
	children?: HastNode[]
}

function portableNodeToHast(node: MarkdownPortableNode): HastNode {
	if (node.type === "text") return { type: "text", value: node.value }
	if (node.type === "container") {
		return {
			type: "element",
			tagName: "span",
			properties: { className: ["markdown-semantic-container"] },
			children: node.children.map(portableNodeToHast),
		}
	}
	if (node.type === "span") {
		return {
			type: "element",
			tagName: "span",
			properties: node.className ? { className: node.className.split(/\s+/) } : {},
			children: node.children.map(portableNodeToHast),
		}
	}
	if (node.type === "link") {
		const href = sanitizeMarkdownUrl(node.href, "link")
		return {
			type: "element",
			tagName: "a",
			properties: href ? { href } : {},
			children: node.children.map(portableNodeToHast),
		}
	}
	if (node.type === "image") {
		const src = sanitizeMarkdownUrl(node.src, "image")
		return {
			type: "element",
			tagName: "img",
			properties: { alt: node.alt, ...(src ? { src } : {}) },
			children: [],
		}
	}
	return {
		type: "element",
		tagName: "code",
		properties: node.language ? { className: [`language-${node.language}`] } : {},
		children: [{ type: "text", value: node.value }],
	}
}

function transformChildren(parent: HastNode, surface: MarkdownSemanticSurface): void {
	const children = parent.children
	if (!children) return
	for (let index = 0; index < children.length; index++) {
		const node = children[index]
		if (node.type === "element") {
			if (node.tagName !== "code" && node.tagName !== "pre") transformChildren(node, surface)
			continue
		}
		if (node.type !== "text" || !node.value) continue
		const transforms = getMarkdownTextTransforms(node.value, surface)
		if (transforms.length === 0) continue
		const replacements: HastNode[] = []
		let position = 0
		for (const transform of transforms) {
			if (position < transform.from) {
				replacements.push({ type: "text", value: node.value.slice(position, transform.from) })
			}
			replacements.push(...transform.nodes.map(portableNodeToHast))
			position = transform.to
		}
		if (position < node.value.length) {
			replacements.push({ type: "text", value: node.value.slice(position) })
		}
		children.splice(index, 1, ...replacements)
		index += replacements.length - 1
	}
}

export function createRehypeSemanticRegistrations(surface: MarkdownSemanticSurface): Plugin {
	return () => {
		return (tree, file) => {
			if (!getRendererFeatureFlags(file).hasTextTransforms) return
			transformChildren(tree as HastNode, surface)
		}
	}
}
