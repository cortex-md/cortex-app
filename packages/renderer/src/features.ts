import { containsMarkdownMath } from "./mathSyntax"

export interface RendererFeatureFlags {
	hasCallouts: boolean
	hasWikiLinks: boolean
	hasTaskLists: boolean
	hasCodeBlocks: boolean
	hasTextTransforms: boolean
	hasTables: boolean
	hasGfmSyntax: boolean
	hasMath: boolean
}

interface RendererFeatureOptions {
	forceAll?: boolean
	hasTextTransforms: boolean
}

const rendererFeatureDataKey = "cortexRendererFeatures"

const allRendererFeatures: RendererFeatureFlags = {
	hasCallouts: true,
	hasWikiLinks: true,
	hasTaskLists: true,
	hasCodeBlocks: true,
	hasTextTransforms: true,
	hasTables: true,
	hasGfmSyntax: true,
	hasMath: true,
}

const taskListPattern = /(?:^|\n)\s{0,3}(?:[-+*]|\d+[.)])\s+\[[ xX]\](?:\s|$)/
const codeBlockPattern = /(?:^|\n)(?:\s{0,3}(?:```|~~~)|(?: {4}|\t)\S)/
const calloutPattern = /(?:^|\n)>\s*\[!/
const tablePattern = /(?:^|\n)\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?(?=\n|$)/
const autolinkLiteralPattern = /(?:^|[\s(])(?:https?:\/\/|www\.)[^\s<]+/g
const footnotePattern = /(?:^|\n)\[\^[^\]\n]+]:|(?:^|[^[])\[\^[^\]\n]+]/
const mathCandidatePattern = /(?:^|\n)\s{0,3}(?:\$\$|\\\[)(?:\s|$)|(?:^|[^\\])(?:\$|\\\()/

function hasAutolinkLiteral(markdown: string): boolean {
	autolinkLiteralPattern.lastIndex = 0
	for (const match of markdown.matchAll(autolinkLiteralPattern)) {
		const prefix = match[0][0]
		if (prefix === "(" && match.index > 0 && markdown[match.index - 1] === "]") continue
		return true
	}
	return false
}

function isRendererFeatureFlags(value: unknown): value is RendererFeatureFlags {
	if (typeof value !== "object" || value === null) return false
	const flags = value as RendererFeatureFlags
	return (
		typeof flags.hasCallouts === "boolean" &&
		typeof flags.hasWikiLinks === "boolean" &&
		typeof flags.hasTaskLists === "boolean" &&
		typeof flags.hasCodeBlocks === "boolean" &&
		typeof flags.hasTextTransforms === "boolean" &&
		typeof flags.hasTables === "boolean" &&
		typeof flags.hasGfmSyntax === "boolean" &&
		typeof flags.hasMath === "boolean"
	)
}

export function detectRendererFeatureFlags(
	markdown: string,
	options: RendererFeatureOptions,
): RendererFeatureFlags {
	if (options.forceAll) {
		return {
			...allRendererFeatures,
			hasMath: mathCandidatePattern.test(markdown) && containsMarkdownMath(markdown),
		}
	}
	return {
		hasCallouts: calloutPattern.test(markdown),
		hasWikiLinks: markdown.includes("[["),
		hasTaskLists: taskListPattern.test(markdown),
		hasCodeBlocks: codeBlockPattern.test(markdown),
		hasTextTransforms: options.hasTextTransforms,
		hasTables: tablePattern.test(markdown),
		hasGfmSyntax:
			markdown.includes("~~") || hasAutolinkLiteral(markdown) || footnotePattern.test(markdown),
		hasMath: mathCandidatePattern.test(markdown) && containsMarkdownMath(markdown),
	}
}

export function getRendererFeatureFlags(file: unknown): RendererFeatureFlags {
	const data = (file as { data?: Record<string, unknown> } | undefined)?.data
	const features = data?.[rendererFeatureDataKey]
	return isRendererFeatureFlags(features) ? features : allRendererFeatures
}

export function createRendererFeatureData(features: RendererFeatureFlags): Record<string, unknown> {
	return { [rendererFeatureDataKey]: features }
}
