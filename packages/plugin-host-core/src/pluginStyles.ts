import {
	type Atrule,
	generate,
	parse,
	type Rule,
	type Selector,
	type SelectorList,
	type StyleSheet,
	walk,
} from "css-tree"

const blockedAtRules = new Set(["font-face", "import", "keyframes", "namespace", "page"])
const scopedAtRules = new Set(["container", "layer", "media", "supports"])
const markdownSurfaceSelector = ":where(.markdown-surface)"

export interface PluginMarkdownStyleHost {
	install: (pluginId: string, css: string | null) => void
	remove: (pluginId: string) => void
}

type SelectorNode = {
	type: string
	name?: string
	children?: {
		toArray(): SelectorNode[]
	}
}

let pluginMarkdownStyleHost: PluginMarkdownStyleHost | null = null

function isMarkdownSurfaceClass(node: SelectorNode): boolean {
	return node.type === "ClassSelector" && node.name === "markdown-surface"
}

function isMarkdownSurfaceWhere(node: SelectorNode): boolean {
	if (node.type !== "PseudoClassSelector" || node.name !== "where") return false
	const selectorList = node.children?.toArray()[0]
	if (selectorList?.type !== "SelectorList") return false
	const selectors = selectorList.children?.toArray() ?? []
	if (selectors.length === 0) return false
	return selectors.every((selector) => {
		const children = selector.children?.toArray() ?? []
		return children.length === 1 && isMarkdownSurfaceClass(children[0])
	})
}

function getMarkdownSurfaceScopeState(selector: string): "scoped" | "unscoped" | "unsafe" {
	const parsed = parse(selector, { context: "selector" }) as Selector
	const children = (parsed as SelectorNode).children?.toArray() ?? []
	const firstCombinatorIndex = children.findIndex((node) => node.type === "Combinator")
	const rootNodes = firstCombinatorIndex === -1 ? children : children.slice(0, firstCombinatorIndex)
	const hasMarkdownSurfaceRoot = rootNodes.some(
		(node) => isMarkdownSurfaceClass(node) || isMarkdownSurfaceWhere(node),
	)
	if (!hasMarkdownSurfaceRoot) return "unscoped"
	const combinator = firstCombinatorIndex >= 0 ? children[firstCombinatorIndex]?.name : undefined
	if (combinator === "+" || combinator === "~") return "unsafe"
	return "scoped"
}

function scopeSelector(selector: string): string {
	const normalized = selector.trim()
	const scopeState = getMarkdownSurfaceScopeState(normalized)
	if (scopeState === "unsafe") {
		throw new Error("Plugin styles cannot target siblings outside markdown surfaces")
	}
	if (scopeState === "scoped") {
		return normalized
	}
	return `${markdownSurfaceSelector} ${normalized}`
}

export function scopePluginMarkdownStyles(source: string): string {
	const stylesheet = parse(source, { context: "stylesheet" }) as StyleSheet

	walk(stylesheet, {
		visit: "Atrule",
		enter(node: Atrule) {
			const name = node.name.toLowerCase()
			if (blockedAtRules.has(name) || !scopedAtRules.has(name)) {
				throw new Error(`Plugin styles cannot use @${name}`)
			}
		},
	})

	walk(stylesheet, {
		visit: "Rule",
		enter(node: Rule) {
			if (node.prelude.type !== "SelectorList") {
				throw new Error("Plugin styles contain an unsupported selector")
			}
			const selectors = node.prelude.children
				.toArray()
				.map((selector) => scopeSelector(generate(selector)))
			node.prelude = parse(selectors.join(","), { context: "selectorList" }) as SelectorList
		},
	})

	return generate(stylesheet)
}

export function setPluginMarkdownStyleHost(host: PluginMarkdownStyleHost | null): void {
	pluginMarkdownStyleHost = host
}

export function installPluginMarkdownStyles(pluginId: string, css: string | null): void {
	pluginMarkdownStyleHost?.install(pluginId, css)
}

export function removePluginMarkdownStyles(pluginId: string): void {
	pluginMarkdownStyleHost?.remove(pluginId)
}
