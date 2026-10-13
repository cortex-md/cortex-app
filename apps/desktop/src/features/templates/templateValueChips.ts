import type { EditorExtensionFactory, EditorRuntimeView } from "@cortex/editor/types"
import { getTemplateValueLabel } from "@cortex/templates"
import { tagVariants } from "@cortex/ui"

const tokenPattern = /\{\{\s*([^{}]+?)\s*\}\}/g

export interface TemplateValueChipOptions {
	isCodeMode: () => boolean
	describe: (expression: string) => string
}

export function refreshTemplateValueChips(view: EditorRuntimeView | null): void {
	view?.dispatch({})
}

export function templateValueChipsExtension(
	options: TemplateValueChipOptions,
): EditorExtensionFactory {
	return (runtime) => {
		const { Decoration, ViewPlugin, WidgetType } = runtime.view
		const chipClassName = tagVariants({ variant: "active" })

		class ValueChipWidget extends WidgetType {
			constructor(
				readonly expression: string,
				readonly example: string,
			) {
				super()
			}

			eq(other: ValueChipWidget) {
				return other.expression === this.expression && other.example === this.example
			}

			toDOM() {
				const chip = document.createElement("span")
				chip.className = `template-value-chip ${chipClassName}`
				chip.dataset.slot = "tag"
				chip.textContent = getTemplateValueLabel(this.expression)
				if (this.example) chip.title = `Becomes ${this.example}`
				return chip
			}

			ignoreEvent() {
				return false
			}
		}

		const build = (view: EditorRuntimeView) => {
			if (options.isCodeMode()) return Decoration.none
			const ranges = []
			const selection = view.state.selection.main
			for (const { from, to } of view.visibleRanges) {
				const text = view.state.doc.sliceString(from, to)
				for (const match of text.matchAll(tokenPattern)) {
					const start = from + (match.index ?? 0)
					const end = start + match[0].length
					if (selection.from <= end && selection.to >= start) continue
					const expression = match[1].trim()
					ranges.push(
						Decoration.replace({
							widget: new ValueChipWidget(expression, options.describe(expression)),
						}).range(start, end),
					)
				}
			}
			return Decoration.set(ranges, true)
		}

		return ViewPlugin.fromClass(
			class {
				decorations
				constructor(view: EditorRuntimeView) {
					this.decorations = build(view)
				}
				update(update: { view: EditorRuntimeView }) {
					this.decorations = build(update.view)
				}
			},
			{ decorations: (plugin) => plugin.decorations },
		)
	}
}
