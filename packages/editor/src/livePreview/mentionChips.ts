import { MENTION_PATTERN } from "@cortex/comments"
import type {
	EditorRuntimeDecorationSet,
	EditorRuntimeModules,
	EditorRuntimeView,
	EditorRuntimeViewUpdate,
} from "../types"

const CODE_NODE_NAMES = new Set(["FencedCode", "CodeBlock", "InlineCode", "CodeText"])

function isInsideCode(runtime: EditorRuntimeModules, view: EditorRuntimeView, position: number) {
	let node = runtime.language.syntaxTree(view.state).resolveInner(position, 1)
	while (node) {
		if (CODE_NODE_NAMES.has(node.name)) return true
		const parent = node.parent
		if (!parent) return false
		node = parent
	}
	return false
}

function selectionInside(view: EditorRuntimeView, from: number, to: number): boolean {
	return view.state.selection.ranges.some((range) => range.from < to && range.to > from)
}

export function createMentionChipsPlugin(runtime: EditorRuntimeModules) {
	const { Decoration, ViewPlugin, WidgetType } = runtime.view

	class MentionChipWidget extends WidgetType {
		constructor(readonly name: string) {
			super()
		}

		eq(other: MentionChipWidget) {
			return other.name === this.name
		}

		toDOM() {
			const chip = document.createElement("span")
			chip.className = "cm-mention"
			chip.textContent = this.name
			chip.setAttribute("data-mention", this.name)
			return chip
		}

		ignoreEvent() {
			return false
		}
	}

	const buildDecorations = (view: EditorRuntimeView): EditorRuntimeDecorationSet => {
		const ranges = []
		for (const visible of view.visibleRanges) {
			const text = view.state.sliceDoc(visible.from, visible.to)
			for (const match of text.matchAll(MENTION_PATTERN)) {
				const from = visible.from + (match.index ?? 0)
				const to = from + match[0].length
				const name = match[1]?.trim()
				if (!name || selectionInside(view, from, to) || isInsideCode(runtime, view, from)) continue
				ranges.push(Decoration.replace({ widget: new MentionChipWidget(name) }).range(from, to))
			}
		}
		return Decoration.set(ranges, true)
	}

	return ViewPlugin.fromClass(
		class {
			decorations: EditorRuntimeDecorationSet

			constructor(view: EditorRuntimeView) {
				this.decorations = buildDecorations(view)
			}

			update(update: EditorRuntimeViewUpdate) {
				if (update.docChanged || update.selectionSet || update.viewportChanged) {
					this.decorations = buildDecorations(update.view)
				}
			}
		},
		{ decorations: (plugin) => plugin.decorations },
	)
}
