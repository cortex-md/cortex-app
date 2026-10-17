import type { EditorExtensionFactory } from "./types"

export type InlineTagClickHandler = (tag: string) => void

export function findInlineTagTarget(target: EventTarget | null): string | null {
	if (!(target instanceof Element)) return null
	return target.closest<HTMLElement>("[data-tag]")?.dataset.tag ?? null
}

export function inlineTagClickExtension(onTagClick: InlineTagClickHandler): EditorExtensionFactory {
	return (runtime) =>
		runtime.view.EditorView.domEventHandlers({
			mousedown(event: MouseEvent) {
				if (event.button !== 0 || !(event.metaKey || event.ctrlKey)) return false
				const tag = findInlineTagTarget(event.target)
				if (!tag) return false
				event.preventDefault()
				onTagClick(tag)
				return true
			},
		})
}
