import {
	getMarkdownRegistryVersion,
	getMarkdownTextTransforms,
	resolveCalloutType,
	subscribeCalloutTypes,
	subscribeMarkdownRegistry,
} from "@cortex/renderer"
import { resolveTableCellFromPointer, type TablePointerCellTarget } from "../tablePointer"
import type {
	EditorRuntimeDecorationRange,
	EditorRuntimeDecorationSet,
	EditorRuntimeModules,
	EditorRuntimeStateField,
	EditorRuntimeView,
	EditorRuntimeViewUpdate,
} from "../types"
import type { LivePreviewBlockState } from "./blockState"
import type { LivePreviewEffects } from "./effects"
import {
	recordCandidateBlocks,
	recordDecorationsProduced,
	recordSyntaxNodeVisit,
	recordViewportPass,
} from "./metrics"
import {
	blockUsesReplacement,
	type CalloutBlock,
	type CodeBlock,
	findBlockContainingRange,
	findBlocksInRange,
	type MarkdownBlock,
	selectionOverlapsBlock,
} from "./model"
import type { createLivePreviewWidgets } from "./widgets"

type LivePreviewWidgets = ReturnType<typeof createLivePreviewWidgets>

interface SyntaxNodeLike {
	name: string
	from: number
	to: number
	firstChild: SyntaxNodeLike | null
	nextSibling: SyntaxNodeLike | null
	parent: SyntaxNodeLike | null
}

interface SyntaxNodeRefLike {
	node: SyntaxNodeLike
}

function childNodes(node: SyntaxNodeLike, name: string): SyntaxNodeLike[] {
	const children: SyntaxNodeLike[] = []
	for (let child = node.firstChild; child; child = child.nextSibling) {
		if (child.name === name) children.push(child)
	}
	return children
}

function selectionOverlapsRange(view: EditorRuntimeView, from: number, to: number): boolean {
	return view.state.selection.ranges.some((range) => range.from <= to && range.to >= from)
}

function hiddenBlockContaining(
	blocks: readonly MarkdownBlock[],
	from: number,
	to: number,
): MarkdownBlock | undefined {
	return findBlockContainingRange(blocks, from, to)
}

function calloutContaining(
	blocks: MarkdownBlock[],
	from: number,
	to: number,
): CalloutBlock | undefined {
	return hiddenBlockContaining(blocks, from, to) as CalloutBlock | undefined
}

function blockquoteContaining(
	blocks: MarkdownBlock[],
	from: number,
	to: number,
): MarkdownBlock | undefined {
	return hiddenBlockContaining(blocks, from, to)
}

function replacementRange(
	runtime: EditorRuntimeModules,
	ranges: EditorRuntimeDecorationRange[],
	from: number,
	to: number,
): void {
	if (from < to) ranges.push(runtime.view.Decoration.replace({}).range(from, to))
}

function addFormatting(
	runtime: EditorRuntimeModules,
	view: EditorRuntimeView,
	ranges: EditorRuntimeDecorationRange[],
	node: SyntaxNodeLike,
): void {
	const className =
		node.name === "StrongEmphasis"
			? "cm-bold"
			: node.name === "Emphasis"
				? "cm-italic"
				: "cm-strikethrough"
	const markName = node.name === "Strikethrough" ? "StrikethroughMark" : "EmphasisMark"
	const marks = childNodes(node, markName)
	if (marks.length < 2) return
	const open = marks[0]
	const close = marks.at(-1)
	if (!close) return

	ranges.push(runtime.view.Decoration.mark({ class: className }).range(open.to, close.from))
	if (!selectionOverlapsRange(view, node.from, node.to)) {
		replacementRange(runtime, ranges, open.from, open.to)
		replacementRange(runtime, ranges, close.from, close.to)
	}
}

function addInlineCode(
	runtime: EditorRuntimeModules,
	view: EditorRuntimeView,
	ranges: EditorRuntimeDecorationRange[],
	node: SyntaxNodeLike,
): void {
	const marks = childNodes(node, "CodeMark")
	if (marks.length < 2) return
	const open = marks[0]
	const close = marks.at(-1)
	if (!close) return

	ranges.push(runtime.view.Decoration.mark({ class: "cm-inline-code" }).range(open.to, close.from))
	if (!selectionOverlapsRange(view, node.from, node.to)) {
		replacementRange(runtime, ranges, open.from, open.to)
		replacementRange(runtime, ranges, close.from, close.to)
	}
}

function addLink(
	runtime: EditorRuntimeModules,
	view: EditorRuntimeView,
	ranges: EditorRuntimeDecorationRange[],
	node: SyntaxNodeLike,
): void {
	const marks = childNodes(node, "LinkMark")
	if (marks.length < 2) return
	const textFrom = marks[0].to
	const textTo = marks[1].from
	if (textFrom >= textTo) return
	ranges.push(runtime.view.Decoration.mark({ class: "cm-link" }).range(textFrom, textTo))
	if (!selectionOverlapsRange(view, node.from, node.to)) {
		replacementRange(runtime, ranges, node.from, textFrom)
		replacementRange(runtime, ranges, textTo, node.to)
	}
}

function addWikiLink(
	runtime: EditorRuntimeModules,
	view: EditorRuntimeView,
	ranges: EditorRuntimeDecorationRange[],
	node: SyntaxNodeLike,
): void {
	if (node.to - node.from < 4) return
	ranges.push(
		runtime.view.Decoration.mark({ class: "cm-wiki-link" }).range(node.from + 2, node.to - 2),
	)
	if (!selectionOverlapsRange(view, node.from, node.to)) {
		replacementRange(runtime, ranges, node.from, node.from + 2)
		replacementRange(runtime, ranges, node.to - 2, node.to)
	}
}

function addHeadingMarker(
	runtime: EditorRuntimeModules,
	view: EditorRuntimeView,
	ranges: EditorRuntimeDecorationRange[],
	node: SyntaxNodeLike,
): void {
	if (selectionOverlapsRange(view, node.from, node.to)) return
	const line = view.state.doc.lineAt(node.from)
	for (const mark of childNodes(node, "HeaderMark")) {
		replacementRange(runtime, ranges, mark.from, Math.min(mark.to + 1, line.to))
	}
}

function addQuoteMarker(
	runtime: EditorRuntimeModules,
	view: EditorRuntimeView,
	ranges: EditorRuntimeDecorationRange[],
	node: SyntaxNodeLike,
	ownerBlock: MarkdownBlock | undefined,
): void {
	if (ownerBlock?.kind === "callout" && node.from < ownerBlock.titleFrom) return
	const owner = ownerBlock ?? { from: node.from, to: node.to }
	if (selectionOverlapsRange(view, owner.from, owner.to)) return
	const line = view.state.doc.lineAt(node.from)
	replacementRange(runtime, ranges, node.from, Math.min(node.to + 1, line.to))
}

function addListMarker(
	runtime: EditorRuntimeModules,
	widgets: LivePreviewWidgets,
	view: EditorRuntimeView,
	ranges: EditorRuntimeDecorationRange[],
	node: SyntaxNodeLike,
): void {
	const line = view.state.doc.lineAt(node.from)
	if (selectionOverlapsRange(view, line.from, line.to)) return
	const source = view.state.sliceDoc(node.from, node.to)
	const marker = /^[*+-]$/.test(source) ? "•" : source
	ranges.push(
		runtime.view.Decoration.replace({
			widget: new widgets.TextWidget(marker, "cm-list-marker"),
		}).range(node.from, node.to),
	)
}

function addCalloutTitle(
	runtime: EditorRuntimeModules,
	widgets: LivePreviewWidgets,
	view: EditorRuntimeView,
	ranges: EditorRuntimeDecorationRange[],
	block: CalloutBlock,
): void {
	if (selectionOverlapsBlock(view.state.selection, block)) return
	const firstLine = view.state.doc.line(block.firstLine)
	replacementRange(runtime, ranges, block.from, block.titleFrom)
	if (block.titleFrom < firstLine.to) {
		ranges.push(
			runtime.view.Decoration.mark({ class: "markdown-callout-title-source" }).range(
				block.titleFrom,
				firstLine.to,
			),
		)
	} else {
		ranges.push(
			runtime.view.Decoration.widget({
				widget: new widgets.TextWidget(
					resolveCalloutType(block.callout.type).label,
					"markdown-callout-title-source",
				),
				side: 1,
			}).range(firstLine.to),
		)
	}
	if (block.callout.fold) {
		ranges.push(
			runtime.view.Decoration.widget({
				widget: new widgets.CalloutFoldWidget(block.id),
				side: 2,
			}).range(firstLine.to),
		)
	}
}

function isCodeNode(node: SyntaxNodeLike | null): boolean {
	for (let current = node; current; current = current.parent) {
		if (current.name === "InlineCode" || current.name === "FencedCode") return true
	}
	return false
}

function addSemanticTransforms(
	runtime: EditorRuntimeModules,
	widgets: LivePreviewWidgets,
	view: EditorRuntimeView,
	ranges: EditorRuntimeDecorationRange[],
	hiddenBlocks: readonly MarkdownBlock[],
	visibleRange: { from: number; to: number },
): void {
	const tree = runtime.language.syntaxTree(view.state)
	let position = visibleRange.from
	while (position <= visibleRange.to) {
		const line = view.state.doc.lineAt(position)
		const segmentFrom = Math.max(line.from, visibleRange.from)
		const segmentTo = Math.min(line.to, visibleRange.to)
		const text = view.state.sliceDoc(segmentFrom, segmentTo)
		for (const transform of getMarkdownTextTransforms(text, "live-preview")) {
			const from = segmentFrom + transform.from
			const to = segmentFrom + transform.to
			if (
				hiddenBlockContaining(hiddenBlocks, from, to) ||
				selectionOverlapsRange(view, from, to) ||
				isCodeNode(tree.resolveInner(from, 1) as SyntaxNodeLike)
			) {
				continue
			}
			const original = text.slice(transform.from, transform.to)
			const onlyNode = transform.nodes.length === 1 ? transform.nodes[0] : undefined
			if (
				onlyNode?.type === "span" &&
				onlyNode.className &&
				onlyNode.children.length === 1 &&
				onlyNode.children[0].type === "text" &&
				onlyNode.children[0].value === original
			) {
				ranges.push(runtime.view.Decoration.mark({ class: onlyNode.className }).range(from, to))
			} else if (onlyNode?.type === "text") {
				ranges.push(
					runtime.view.Decoration.replace({
						widget: new widgets.TextWidget(onlyNode.value),
					}).range(from, to),
				)
			} else {
				ranges.push(
					runtime.view.Decoration.replace({
						widget: new widgets.PortableNodeWidget(transform.nodes),
					}).range(from, to),
				)
			}
		}
		if (line.to >= visibleRange.to) break
		position = line.to + 1
	}
}

function addCodeControls(
	runtime: EditorRuntimeModules,
	widgets: LivePreviewWidgets,
	view: EditorRuntimeView,
	ranges: EditorRuntimeDecorationRange[],
	blocks: readonly CodeBlock[],
	hoveredCodeBlockId: string | null,
): void {
	for (const block of blocks) {
		if (selectionOverlapsBlock(view.state.selection, block)) continue
		const hovered = hoveredCodeBlockId === block.id
		if (!hovered && !block.language) continue
		ranges.push(
			runtime.view.Decoration.widget({
				widget: new widgets.CodeBlockChromeWidget(block.code, block.id, block.language, hovered),
				side: 1,
			}).range(block.openFenceTo),
		)
	}
}

function buildVisibleDecorations(
	runtime: EditorRuntimeModules,
	_effects: LivePreviewEffects,
	widgets: LivePreviewWidgets,
	view: EditorRuntimeView,
	blockField: EditorRuntimeStateField<LivePreviewBlockState>,
	hoveredCodeBlockId: string | null,
): EditorRuntimeDecorationSet {
	recordViewportPass()
	const blockState = view.state.field(blockField) as LivePreviewBlockState
	const ranges: EditorRuntimeDecorationRange[] = []
	const tree = runtime.language.syntaxTree(view.state)
	const visibleCallouts = new Map<string, CalloutBlock>()
	const visibleCodeBlocks = new Map<string, CodeBlock>()

	for (const visibleRange of view.visibleRanges) {
		const hiddenBlocks = findBlocksInRange(
			blockState.replacementBlocks,
			visibleRange.from,
			visibleRange.to,
		)
		const calloutBlocks = findBlocksInRange(
			blockState.index.callouts,
			visibleRange.from,
			visibleRange.to,
		)
		const blockquoteBlocks = findBlocksInRange(
			blockState.index.blockquotes,
			visibleRange.from,
			visibleRange.to,
		)
		const codeBlocks = findBlocksInRange(blockState.index.code, visibleRange.from, visibleRange.to)
		const projectionBlockedBlocks = hiddenBlocks
		recordCandidateBlocks(
			projectionBlockedBlocks.length +
				calloutBlocks.length +
				blockquoteBlocks.length +
				codeBlocks.length,
		)
		for (const block of calloutBlocks) visibleCallouts.set(block.id, block)
		for (const block of codeBlocks) visibleCodeBlocks.set(block.id, block)

		tree.iterate({
			from: visibleRange.from,
			to: visibleRange.to,
			enter(nodeRef: SyntaxNodeRefLike) {
				recordSyntaxNodeVisit()
				const node = nodeRef.node as SyntaxNodeLike
				if (hiddenBlockContaining(projectionBlockedBlocks, node.from, node.to)) return false
				const callout = calloutContaining(calloutBlocks, node.from, node.to)
				const blockquote = blockquoteContaining(blockquoteBlocks, node.from, node.to)

				if (
					node.name === "StrongEmphasis" ||
					node.name === "Emphasis" ||
					node.name === "Strikethrough"
				) {
					addFormatting(runtime, view, ranges, node)
				} else if (node.name === "InlineCode") {
					addInlineCode(runtime, view, ranges, node)
				} else if (node.name === "Link") {
					if (!callout || node.from >= callout.titleFrom) addLink(runtime, view, ranges, node)
				} else if (node.name === "WikiLink") {
					addWikiLink(runtime, view, ranges, node)
				} else if (node.name.startsWith("ATXHeading")) {
					addHeadingMarker(runtime, view, ranges, node)
				} else if (node.name === "QuoteMark") {
					addQuoteMarker(runtime, view, ranges, node, callout ?? blockquote)
				} else if (node.name === "ListMark") {
					addListMarker(runtime, widgets, view, ranges, node)
				} else if (node.name === "TaskMarker") {
					if (!selectionOverlapsRange(view, node.from, node.to)) {
						const checked = /^\[[xX]\]$/.test(view.state.sliceDoc(node.from, node.to))
						ranges.push(
							runtime.view.Decoration.replace({
								widget: new widgets.CheckboxWidget(checked, node.from),
							}).range(node.from, node.to),
						)
					}
				}
			},
		})
		addSemanticTransforms(runtime, widgets, view, ranges, projectionBlockedBlocks, visibleRange)
	}

	for (const block of visibleCallouts.values()) {
		if (!blockUsesReplacement(block, blockState.collapsedCallouts, view.state.selection)) {
			addCalloutTitle(runtime, widgets, view, ranges, block)
		}
	}
	addCodeControls(
		runtime,
		widgets,
		view,
		ranges,
		[...visibleCodeBlocks.values()],
		hoveredCodeBlockId,
	)
	recordDecorationsProduced(ranges.length)
	return runtime.view.Decoration.set(ranges, true)
}

function findCodeBlockId(target: EventTarget | null): string | null {
	if (!(target instanceof HTMLElement)) return null
	return target.closest<HTMLElement>("[data-codeblock-id]")?.dataset.codeblockId ?? null
}

function positionFromTableCellCoordinates(
	view: EditorRuntimeView,
	event: MouseEvent,
	from: number,
	to: number,
	useCellCursor: boolean,
	cursor: number,
	empty: boolean,
): number | null {
	const clientX = Number(event.clientX)
	const clientY = Number(event.clientY)
	if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null

	if (useCellCursor) return cursor
	if (empty) return cursor

	let position: number | null = null
	try {
		position = view.posAtCoords({ x: clientX, y: clientY })
	} catch {
		position = null
	}
	if (position !== null && position >= from && position <= to) return position
	if (position !== null && position < from) return from
	if (position !== null && position > to) return to

	return cursor
}

function getTableCellPointerPosition(
	view: EditorRuntimeView,
	event: MouseEvent,
	target: TablePointerCellTarget,
): number | null {
	return (
		positionFromTableCellCoordinates(
			view,
			event,
			target.contentFrom,
			target.contentTo,
			target.useCellCursor,
			target.cursor,
			target.empty,
		) ?? target.cursor
	)
}

function placeCursorFromTableCellPointer(view: EditorRuntimeView, event: MouseEvent): boolean {
	if (event.defaultPrevented) return false
	const target = resolveTableCellFromPointer(view, event)
	if (!target) return false

	if (event.button === 2) {
		event.preventDefault()
		return false
	}
	if (event.button !== 0) return false
	if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false
	if (target.hitsText) return false

	const position = getTableCellPointerPosition(view, event, target)
	if (position === null) return false

	event.preventDefault()
	view.dispatch({ selection: { anchor: position } })
	view.focus()
	return true
}

export function createVisibleDecorationsPlugin(
	runtime: EditorRuntimeModules,
	effects: LivePreviewEffects,
	widgets: LivePreviewWidgets,
	blockField: EditorRuntimeStateField<LivePreviewBlockState>,
) {
	return runtime.view.ViewPlugin.fromClass(
		class {
			decorations: EditorRuntimeDecorationSet
			hoveredCodeBlockId: string | null = null
			markdownRegistryVersion = getMarkdownRegistryVersion()
			unsubscribeMarkdown: () => void
			unsubscribeCallouts: () => void

			constructor(readonly view: EditorRuntimeView) {
				this.decorations = buildVisibleDecorations(
					runtime,
					effects,
					widgets,
					view,
					blockField,
					this.hoveredCodeBlockId,
				)
				this.unsubscribeMarkdown = subscribeMarkdownRegistry(() => {
					this.view.dispatch({ effects: effects.livePreviewRegistryChanged.of() })
				})
				this.unsubscribeCallouts = subscribeCalloutTypes(() => {
					this.view.dispatch({ effects: effects.livePreviewRegistryChanged.of() })
				})
			}

			update(update: EditorRuntimeViewUpdate) {
				const hoveredEffect = update.transactions
					.flatMap((transaction) => transaction.effects)
					.find((effect) => effect.is(effects.hoveredCodeBlockChanged))
				if (hoveredEffect) this.hoveredCodeBlockId = hoveredEffect.value

				const registryChanged = update.transactions.some((transaction) =>
					transaction.effects.some((effect) => effect.is(effects.livePreviewRegistryChanged)),
				)
				const calloutToggled = update.transactions.some((transaction) =>
					transaction.effects.some((effect) => effect.is(effects.toggleCalloutCollapsed)),
				)
				if (registryChanged && this.markdownRegistryVersion !== getMarkdownRegistryVersion()) {
					this.markdownRegistryVersion = getMarkdownRegistryVersion()
				}

				if (
					update.docChanged ||
					update.selectionSet ||
					update.viewportChanged ||
					hoveredEffect ||
					registryChanged ||
					calloutToggled
				) {
					this.decorations = buildVisibleDecorations(
						runtime,
						effects,
						widgets,
						update.view,
						blockField,
						this.hoveredCodeBlockId,
					)
				}
			}

			destroy() {
				this.unsubscribeMarkdown()
				this.unsubscribeCallouts()
			}
		},
		{
			decorations: (plugin) => plugin.decorations,
			eventHandlers: {
				pointerover(event: PointerEvent, view: EditorRuntimeView) {
					const blockId = findCodeBlockId(event.target)
					view.dispatch({ effects: effects.hoveredCodeBlockChanged.of(blockId) })
				},
				pointerout(event: PointerEvent, view: EditorRuntimeView) {
					const current = findCodeBlockId(event.target)
					const next = findCodeBlockId(event.relatedTarget)
					if (current === next) return
					view.dispatch({ effects: effects.hoveredCodeBlockChanged.of(next) })
				},
				pointerdown(event: PointerEvent, view: EditorRuntimeView) {
					return placeCursorFromTableCellPointer(view, event)
				},
				mousedown(event: MouseEvent, view: EditorRuntimeView) {
					return placeCursorFromTableCellPointer(view, event)
				},
			},
		},
	)
}
