import type { Plugin } from "unified"
import { visit } from "unist-util-visit"
import { parseCalloutMarker } from "../callouts/model"
import { getCalloutStyleVariables, resolveCalloutType } from "../callouts/registry"
import { getRendererFeatureFlags } from "../features"

type HastNode = {
	type: string
	tagName?: string
	value?: string
	properties?: Record<string, unknown>
	children?: HastNode[]
	position?: {
		start?: {
			line?: number
		}
	}
}

function createCalloutProperties(type: string, fold: string | undefined): Record<string, unknown> {
	const definition = resolveCalloutType(type)
	const styles = getCalloutStyleVariables(definition)
	const className = ["markdown-callout"]
	if (fold) className.push("is-collapsible")
	if (fold === "-") className.push("is-collapsed")
	return {
		className,
		"data-callout": type,
		"data-callout-fold": fold ?? "",
		...(fold === "+" ? { open: true } : {}),
		style: `--callout-color: ${styles.color}; --callout-bg: ${styles.backgroundColor}`,
	}
}

function splitMarkerParagraph(
	paragraph: HastNode,
	markerLength: number,
): { titleChildren: HastNode[]; bodyChildren: HastNode[] } {
	const children = paragraph.children ?? []
	const markerText = children[0]
	if (markerText?.type !== "text") return { titleChildren: [], bodyChildren: [] }

	const markerLine = markerText.position?.start?.line
	const markerTextLines = (markerText.value ?? "").split("\n")
	const titleText = markerTextLines[0].slice(markerLength)
	const bodyText = markerTextLines.slice(1).join("\n")
	const titleChildren: HastNode[] = titleText ? [{ type: "text", value: titleText }] : []
	const bodyChildren: HastNode[] = bodyText ? [{ type: "text", value: bodyText }] : []

	for (const child of children.slice(1)) {
		if (
			markerLine !== undefined &&
			child.position?.start?.line !== undefined &&
			child.position.start.line > markerLine
		) {
			bodyChildren.push(child)
		} else {
			titleChildren.push(child)
		}
	}

	return { titleChildren, bodyChildren }
}

function removeWhitespaceNodes(nodes: HastNode[]): HastNode[] {
	return nodes.filter((node) => node.type !== "text" || Boolean(node.value?.trim()))
}

export const rehypeCallouts: Plugin = () => {
	return (tree, file) => {
		if (!getRendererFeatureFlags(file).hasCallouts) return
		visit(tree, "element", (visitedNode, index, visitedParent) => {
			const node = visitedNode as unknown as HastNode
			const parent = visitedParent as unknown as HastNode | undefined
			if (node.tagName !== "blockquote" || index === undefined || !parent?.children) return

			const markerParagraphIndex = node.children?.findIndex((child) => child.tagName === "p") ?? -1
			if (markerParagraphIndex < 0) return

			const markerParagraph = node.children?.[markerParagraphIndex]
			const markerText = markerParagraph?.children?.[0]
			if (markerParagraph?.tagName !== "p" || markerText?.type !== "text") return

			const markerLine = `> ${markerText.value?.split("\n")[0] ?? ""}`
			const marker = parseCalloutMarker(markerLine)
			if (!marker) return
			const fold = marker.fold === "expanded" ? "+" : marker.fold === "collapsed" ? "-" : undefined
			const markerLength = marker.markerLength - 2

			const definition = resolveCalloutType(marker.type)
			const markerContent = splitMarkerParagraph(markerParagraph, markerLength)
			const resolvedTitleChildren =
				markerContent.titleChildren.length > 0
					? markerContent.titleChildren
					: [{ type: "text", value: definition.label } satisfies HastNode]
			const followingChildren = removeWhitespaceNodes(
				node.children?.slice(markerParagraphIndex + 1) ?? [],
			)
			const bodyChildren =
				markerContent.bodyChildren.length > 0
					? [
							{
								type: "element",
								tagName: "p",
								properties: {},
								children: markerContent.bodyChildren,
							},
							...followingChildren,
						]
					: followingChildren
			const titleInnerNode: HastNode = {
				type: "element",
				tagName: "div",
				properties: { className: ["markdown-callout-title-inner"] },
				children: resolvedTitleChildren,
			}
			const titleChildren = [titleInnerNode]
			if (fold) {
				titleChildren.push({
					type: "element",
					tagName: "span",
					properties: {
						className: ["markdown-callout-fold"],
						"aria-hidden": "true",
					},
					children: [],
				})
			}
			const titleNode: HastNode = {
				type: "element",
				tagName: fold ? "summary" : "div",
				properties: {
					className: ["markdown-callout-title"],
					...(fold ? { "data-callout-toggle": "true" } : {}),
				},
				children: titleChildren,
			}
			const contentNode: HastNode = {
				type: "element",
				tagName: "div",
				properties: { className: ["markdown-callout-content"] },
				children: bodyChildren,
			}
			const replacement: HastNode = {
				type: "element",
				tagName: fold ? "details" : "aside",
				properties: createCalloutProperties(marker.type, fold),
				children: [titleNode, contentNode],
			}

			parent.children.splice(index, 1, replacement)
		})
	}
}
