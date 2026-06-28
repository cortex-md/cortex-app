import { getCalloutStyleVariables, resolveCalloutType } from "@cortex/renderer"
import type {
	EditorRuntimeBlockWrapper,
	EditorRuntimeBlockWrapperRange,
	EditorRuntimeBlockWrapperSet,
	EditorRuntimeDecoration,
	EditorRuntimeDecorationRange,
	EditorRuntimeDecorationSet,
	EditorRuntimeModules,
	EditorRuntimeState,
	EditorRuntimeStateField,
	EditorRuntimeTransaction,
	EditorSelectionState,
} from "../types"
import type { LivePreviewEffects } from "./effects"
import { recordBlockPass } from "./metrics"
import {
	blockUsesReplacement,
	type CalloutBlock,
	collectMarkdownBlocks,
	createMarkdownBlockIndex,
	type MarkdownBlock,
	type MarkdownBlockIndex,
	selectionOverlapsBlock,
	type TableRowModel,
} from "./model"
import type { createLivePreviewWidgets } from "./widgets"

type LivePreviewWidgets = ReturnType<typeof createLivePreviewWidgets>

export interface LivePreviewBlockState {
	blocks: MarkdownBlock[]
	index: MarkdownBlockIndex
	replacementBlocks: MarkdownBlock[]
	collapsedCallouts: ReadonlyMap<string, boolean>
	decorations: EditorRuntimeDecorationSet
	outerDecorations: EditorRuntimeDecorationSet
	wrappers: EditorRuntimeBlockWrapperSet
	replacementIds: string
}

interface LivePreviewDecorationSets {
	decorations: EditorRuntimeDecorationSet
	outerDecorations: EditorRuntimeDecorationSet
}

function addLineDecoration(
	state: EditorRuntimeState,
	ranges: EditorRuntimeDecorationRange[],
	block: Pick<MarkdownBlock, "firstLine" | "lastLine">,
	decoration: EditorRuntimeDecoration,
): void {
	for (let lineNumber = block.firstLine; lineNumber <= block.lastLine; lineNumber++) {
		const line = state.doc.line(lineNumber)
		ranges.push(decoration.range(line.from))
	}
}

function calloutLineDecoration(
	runtime: EditorRuntimeModules,
	block: CalloutBlock,
): EditorRuntimeDecoration {
	const definition = resolveCalloutType(block.callout.type)
	const styles = getCalloutStyleVariables(definition)
	return runtime.view.Decoration.line({
		class: "cm-callout-line",
		attributes: {
			"data-callout": block.callout.type,
			style: `--callout-color: ${styles.color}; --callout-bg: ${styles.backgroundColor}`,
		},
	})
}

function addTableRowDecorations(
	runtime: EditorRuntimeModules,
	widgets: LivePreviewWidgets,
	ranges: EditorRuntimeDecorationRange[],
	outerRanges: EditorRuntimeDecorationRange[],
	row: TableRowModel,
	kind: "header" | "delimiter" | "body",
	isLastRenderedRow = false,
): void {
	const rowIndex = kind === "delimiter" ? -1 : row.rowIndex
	const lineClass =
		kind === "header"
			? " cm-table-header-line"
			: kind === "delimiter"
				? " cm-table-delimiter-line"
				: ""
	const delimiterClass = kind === "delimiter" ? " cm-table-delimiter-cell" : ""
	ranges.push(
		runtime.view.Decoration.line({
			class: `cm-table-line cm-table-rendered-line${lineClass}`,
			attributes: {
				...(kind === "delimiter" ? { "aria-hidden": "true" } : {}),
				"data-table-row": "true",
				"data-table-row-last": String(isLastRenderedRow),
				"data-table-row-index": String(rowIndex),
				"data-table-row-kind": kind,
			},
		}).range(row.from),
	)

	let syntaxFrom = row.from
	row.cells.forEach((cell, index) => {
		const emptyCell = cell.contentFrom === cell.contentTo
		const cellAttributes: Record<string, string> = {
			...(kind === "delimiter" ? { "aria-hidden": "true" } : {}),
			"data-align": cell.alignment,
			"data-table-cell": "true",
			"data-table-cell-column-index": String(cell.columnIndex),
			"data-table-cell-cursor": String(cell.cursor),
			"data-table-cell-empty": String(emptyCell),
			"data-table-cell-last-column": String(index === row.cells.length - 1),
			"data-table-cell-row-index": String(rowIndex),
			"data-table-cell-content-from": String(cell.contentFrom),
			"data-table-cell-content-to": String(cell.contentTo),
			"data-table-cell-from": String(cell.from),
			"data-table-cell-source-from": String(cell.sourceFrom),
			"data-table-cell-source-to": String(cell.sourceTo),
			"data-table-cell-to": String(cell.to),
		}
		if (syntaxFrom < cell.from) {
			ranges.push(runtime.view.Decoration.replace({}).range(syntaxFrom, cell.from))
		}
		if (cell.from < cell.to) {
			outerRanges.push(
				runtime.view.Decoration.mark({
					class: `cm-table-cell${delimiterClass}${emptyCell ? " cm-table-cell-empty" : ""}`,
					attributes: cellAttributes,
				}).range(cell.from, cell.to),
			)
		} else {
			ranges.push(
				runtime.view.Decoration.widget({
					widget: new widgets.TableCellPlaceholderWidget(cell),
					side: index,
				}).range(cell.from),
			)
		}
		syntaxFrom = cell.to
	})
	if (syntaxFrom < row.to) {
		ranges.push(runtime.view.Decoration.replace({}).range(syntaxFrom, row.to))
	}
}

function getCalloutCollapsed(
	block: CalloutBlock,
	collapsedCallouts: ReadonlyMap<string, boolean>,
	selection: EditorSelectionState,
): boolean {
	if (selectionOverlapsBlock(selection, block)) return false
	return collapsedCallouts.get(block.id) ?? block.callout.fold === "collapsed"
}

function createBlockWrapper(
	runtime: EditorRuntimeModules,
	block: MarkdownBlock,
	collapsedCallouts: ReadonlyMap<string, boolean>,
	selection: EditorSelectionState,
): EditorRuntimeBlockWrapper | null {
	const selectionOverlaps = selectionOverlapsBlock(selection, block)
	if (block.kind === "code") {
		return runtime.view.BlockWrapper.create({
			tagName: "div",
			attributes: {
				class: `cm-markdown-block cm-codeblock-wrapper${selectionOverlaps ? " is-selection-overlap" : ""}`,
				"data-codeblock-id": block.id,
			},
		})
	}
	if (block.kind === "callout") {
		const definition = resolveCalloutType(block.callout.type)
		const styles = getCalloutStyleVariables(definition)
		const collapsed = getCalloutCollapsed(block, collapsedCallouts, selection)
		return runtime.view.BlockWrapper.create({
			tagName: "div",
			attributes: {
				class: `cm-markdown-block cm-callout-wrapper${collapsed ? " is-collapsed" : ""}${selectionOverlaps ? " is-selection-overlap" : ""}`,
				"data-callout": block.callout.type,
				style: `--callout-color: ${styles.color}; --callout-bg: ${styles.backgroundColor}`,
			},
		})
	}
	if (block.kind === "blockquote") {
		return runtime.view.BlockWrapper.create({
			tagName: "div",
			attributes: { class: "cm-markdown-block cm-blockquote-wrapper" },
		})
	}
	if (block.kind === "table") {
		return runtime.view.BlockWrapper.create({
			tagName: "div",
			attributes: {
				class: "cm-markdown-block cm-table-wrapper",
				"data-table-from": String(block.from),
				"data-table-to": String(block.to),
				"data-table-wrapper": "true",
			},
		})
	}
	if (block.kind === "frontmatter") {
		return runtime.view.BlockWrapper.create({
			tagName: "div",
			attributes: { class: "cm-markdown-block cm-frontmatter-wrapper" },
		})
	}
	return null
}

function buildWrappers(
	runtime: EditorRuntimeModules,
	blocks: MarkdownBlock[],
	collapsedCallouts: ReadonlyMap<string, boolean>,
	selection: EditorSelectionState,
): EditorRuntimeBlockWrapperSet {
	const ranges: EditorRuntimeBlockWrapperRange[] = []
	for (const block of blocks) {
		const wrapper = createBlockWrapper(runtime, block, collapsedCallouts, selection)
		if (wrapper) ranges.push(wrapper.range(block.from, block.to))
	}
	return runtime.view.BlockWrapper.set(ranges, true)
}

function buildDecorationSets(
	runtime: EditorRuntimeModules,
	widgets: LivePreviewWidgets,
	state: EditorRuntimeState,
	blocks: MarkdownBlock[],
	collapsedCallouts: ReadonlyMap<string, boolean>,
): LivePreviewDecorationSets {
	const ranges: EditorRuntimeDecorationRange[] = []
	const outerRanges: EditorRuntimeDecorationRange[] = []

	for (const block of blocks) {
		const selected = selectionOverlapsBlock(state.selection, block)
		const replaced = blockUsesReplacement(block, collapsedCallouts, state.selection)

		if (block.kind === "heading") {
			ranges.push(runtime.view.Decoration.line({ class: `cm-h${block.level}` }).range(block.from))
			continue
		}
		if (block.kind === "blockquote") {
			addLineDecoration(
				state,
				ranges,
				block,
				runtime.view.Decoration.line({ class: "cm-blockquote" }),
			)
			continue
		}
		if (block.kind === "horizontalRule") {
			if (replaced) {
				ranges.push(
					runtime.view.Decoration.line({ class: "cm-horizontal-rule-line" }).range(block.from),
				)
				ranges.push(runtime.view.Decoration.replace({}).range(block.from, block.to))
			}
			continue
		}
		if (block.kind === "code") {
			addLineDecoration(
				state,
				ranges,
				block,
				runtime.view.Decoration.line({
					class: "cm-codeblock-line",
					attributes: { "data-codeblock-id": block.id },
				}),
			)
			if (!selected) {
				ranges.push(
					runtime.view.Decoration.replace({}).range(block.openFenceFrom, block.openFenceTo),
				)
				ranges.push(
					runtime.view.Decoration.replace({}).range(block.closeFenceFrom, block.closeFenceTo),
				)
			}
			continue
		}
		if (block.kind === "callout") {
			addLineDecoration(state, ranges, block, calloutLineDecoration(runtime, block))
			continue
		}
		if (block.kind === "table") {
			addTableRowDecorations(runtime, widgets, ranges, outerRanges, block.table.header, "header")
			addTableRowDecorations(
				runtime,
				widgets,
				ranges,
				outerRanges,
				block.table.delimiter,
				"delimiter",
			)
			for (const [index, row] of block.table.rows.entries()) {
				addTableRowDecorations(
					runtime,
					widgets,
					ranges,
					outerRanges,
					row,
					"body",
					index === block.table.rows.length - 1,
				)
			}
			continue
		}
		if (block.kind === "frontmatter") {
			addLineDecoration(
				state,
				ranges,
				block,
				runtime.view.Decoration.line({ class: "cm-frontmatter-line" }),
			)
			continue
		}
		if (block.kind === "image" && replaced) {
			ranges.push(
				runtime.view.Decoration.replace({ widget: new widgets.ImageWidget(block) }).range(
					block.from,
					block.to,
				),
			)
		}
	}

	return {
		decorations: runtime.view.Decoration.set(ranges, true),
		outerDecorations: runtime.view.Decoration.set(outerRanges, true),
	}
}

function getReplacementIds(
	blocks: MarkdownBlock[],
	collapsedCallouts: ReadonlyMap<string, boolean>,
	selection: EditorSelectionState,
): string {
	const ids: string[] = []
	for (const block of blocks) {
		if (blockUsesReplacement(block, collapsedCallouts, selection)) {
			ids.push(`${block.id}:replaced`)
		}
		if (block.kind === "callout" && getCalloutCollapsed(block, collapsedCallouts, selection)) {
			ids.push(`${block.id}:collapsed`)
		}
		if (block.kind === "callout" && selectionOverlapsBlock(selection, block)) {
			ids.push(`${block.id}:source`)
		}
		if (block.kind === "code" && selectionOverlapsBlock(selection, block)) {
			ids.push(`${block.id}:source`)
		}
	}
	return ids.join("|")
}

function createBlockState(
	runtime: EditorRuntimeModules,
	widgets: LivePreviewWidgets,
	state: EditorRuntimeState,
	resolveImageUrl: (src: string, filePath: string) => string,
	filePath: string,
	collapsedCallouts: ReadonlyMap<string, boolean> = new Map(),
): LivePreviewBlockState {
	recordBlockPass()
	const blocks = collectMarkdownBlocks(runtime, state, resolveImageUrl, filePath)
	const index = createMarkdownBlockIndex(blocks)
	const replacementBlocks = blocks.filter((block) =>
		blockUsesReplacement(block, collapsedCallouts, state.selection),
	)
	const replacementIds = getReplacementIds(blocks, collapsedCallouts, state.selection)
	const decorationSets = buildDecorationSets(runtime, widgets, state, blocks, collapsedCallouts)
	return {
		blocks,
		index,
		replacementBlocks,
		collapsedCallouts,
		replacementIds,
		decorations: decorationSets.decorations,
		outerDecorations: decorationSets.outerDecorations,
		wrappers: buildWrappers(runtime, blocks, collapsedCallouts, state.selection),
	}
}

function mapCollapsedCallouts(
	value: LivePreviewBlockState,
	transaction: EditorRuntimeTransaction,
): ReadonlyMap<string, boolean> {
	const mapped = new Map<string, boolean>()
	for (const block of value.blocks) {
		if (block.kind !== "callout") continue
		const collapsed = value.collapsedCallouts.get(block.id)
		if (collapsed === undefined) continue
		mapped.set(`callout:${transaction.changes.mapPos(block.from, 1)}`, collapsed)
	}
	return mapped
}

export function createLivePreviewBlockField(
	runtime: EditorRuntimeModules,
	effects: LivePreviewEffects,
	widgets: LivePreviewWidgets,
	resolveImageUrl: (src: string, filePath: string) => string,
	filePath: string,
): EditorRuntimeStateField<LivePreviewBlockState> {
	return runtime.state.StateField.define({
		create(state: EditorRuntimeState) {
			return createBlockState(runtime, widgets, state, resolveImageUrl, filePath)
		},
		update(value: LivePreviewBlockState, transaction: EditorRuntimeTransaction) {
			if (transaction.docChanged) {
				return createBlockState(
					runtime,
					widgets,
					transaction.state,
					resolveImageUrl,
					filePath,
					mapCollapsedCallouts(value, transaction),
				)
			}

			const registryChanged = transaction.effects.some((effect) =>
				effect.is(effects.livePreviewRegistryChanged),
			)
			const toggledCallout = transaction.effects.find((effect) =>
				effect.is(effects.toggleCalloutCollapsed),
			)
			let collapsedCallouts = value.collapsedCallouts
			if (toggledCallout) {
				const block = value.blocks.find(
					(candidate) => candidate.kind === "callout" && candidate.id === toggledCallout.value,
				) as CalloutBlock | undefined
				if (block) {
					const next = new Map(collapsedCallouts)
					const current = next.get(block.id) ?? block.callout.fold === "collapsed"
					next.set(block.id, !current)
					collapsedCallouts = next
				}
			}

			const replacementIds = getReplacementIds(
				value.blocks,
				collapsedCallouts,
				transaction.state.selection,
			)
			if (!registryChanged && !toggledCallout && replacementIds === value.replacementIds) {
				return value
			}

			const decorationSets = buildDecorationSets(
				runtime,
				widgets,
				transaction.state,
				value.blocks,
				collapsedCallouts,
			)
			return {
				...value,
				collapsedCallouts,
				replacementIds,
				replacementBlocks: value.blocks.filter((block) =>
					blockUsesReplacement(block, collapsedCallouts, transaction.state.selection),
				),
				decorations: decorationSets.decorations,
				outerDecorations: decorationSets.outerDecorations,
				wrappers: buildWrappers(
					runtime,
					value.blocks,
					collapsedCallouts,
					transaction.state.selection,
				),
			}
		},
		provide(field: EditorRuntimeStateField<LivePreviewBlockState>) {
			return [
				runtime.view.EditorView.decorations.from(
					field,
					(value: LivePreviewBlockState) => value.decorations,
				),
				runtime.view.EditorView.outerDecorations.from(
					field,
					(value: LivePreviewBlockState) => value.outerDecorations,
				),
				runtime.view.EditorView.blockWrappers.from(
					field,
					(value: LivePreviewBlockState) => value.wrappers,
				),
			]
		},
	})
}
