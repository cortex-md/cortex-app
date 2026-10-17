import { findInlineTags } from "@cortex/properties/tags"
import type { Plugin } from "unified"
import { getRendererFeatureFlags } from "../features"
import { findInlineHighlights } from "../inlineMarks"

interface HastNode {
	type: string
	value?: string
	tagName?: string
	properties?: Record<string, unknown>
	children?: HastNode[]
}

const SKIPPED_TAGS = new Set(["code", "pre", "a", "script", "style", "math", "svg", "kbd"])

function hasClass(node: HastNode, className: string): boolean {
	const classes = node.properties?.className
	return Array.isArray(classes) && classes.includes(className)
}

function splitHighlights(value: string): HastNode[] | null {
	const ranges = findInlineHighlights(value)
	if (ranges.length === 0) return null
	const parts: HastNode[] = []
	let last = 0
	for (const range of ranges) {
		if (range.from > last) parts.push({ type: "text", value: value.slice(last, range.from) })
		parts.push({
			type: "element",
			tagName: "mark",
			properties: { className: ["markdown-highlight"] },
			children: [{ type: "text", value: value.slice(range.contentFrom, range.contentTo) }],
		})
		last = range.to
	}
	if (last < value.length) parts.push({ type: "text", value: value.slice(last) })
	return parts
}

function splitTags(value: string): HastNode[] | null {
	const ranges = findInlineTags(value)
	if (ranges.length === 0) return null
	const parts: HastNode[] = []
	let last = 0
	for (const range of ranges) {
		if (range.from > last) parts.push({ type: "text", value: value.slice(last, range.from) })
		parts.push({
			type: "element",
			tagName: "span",
			properties: { className: ["markdown-tag"], "data-tag": range.tag },
			children: [{ type: "text", value: value.slice(range.from, range.to) }],
		})
		last = range.to
	}
	if (last < value.length) parts.push({ type: "text", value: value.slice(last) })
	return parts
}

function splitTagPiece(piece: HastNode): HastNode[] {
	if (piece.type === "text" && piece.value?.includes("#")) return splitTags(piece.value) ?? [piece]
	if (piece.type === "element") transformChildren(piece, true, false)
	return [piece]
}

function transformChildren(node: HastNode, tags: boolean, highlights: boolean): void {
	const children = node.children
	if (!children) return
	const next: HastNode[] = []
	for (const child of children) {
		if (child.type === "text" && child.value) {
			let pieces: HastNode[] = [child]
			if (highlights && child.value.includes("==")) pieces = splitHighlights(child.value) ?? pieces
			if (tags) pieces = pieces.flatMap(splitTagPiece)
			next.push(...pieces)
			continue
		}
		if (
			child.type === "element" &&
			!SKIPPED_TAGS.has(child.tagName ?? "") &&
			!hasClass(child, "katex") &&
			!hasClass(child, "mention")
		) {
			transformChildren(child, tags, highlights)
		}
		next.push(child)
	}
	node.children = next
}

export const rehypeInlineMarks: Plugin = () => {
	return (tree, file) => {
		const features = getRendererFeatureFlags(file)
		if (!features.hasInlineTags && !features.hasHighlights) return
		transformChildren(tree as HastNode, features.hasInlineTags, features.hasHighlights)
	}
}
