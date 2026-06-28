import { type MarkdownPortableNode, sanitizeMarkdownUrl } from "@cortex/renderer"
import type { EditorRuntimeModules, EditorRuntimeView } from "../types"
import type { LivePreviewEffects } from "./effects"
import type { ImageBlock, TableCellModel } from "./model"

function revealSource(view: EditorRuntimeView, from: number): void {
	view.dispatch({ selection: { anchor: from } })
	view.focus()
}

export function createLivePreviewWidgets(
	runtime: EditorRuntimeModules,
	effects: LivePreviewEffects,
) {
	const { WidgetType } = runtime.view

	class TextWidget extends WidgetType {
		constructor(
			readonly text: string,
			readonly className = "",
		) {
			super()
		}

		toDOM() {
			const span = document.createElement("span")
			span.textContent = this.text
			span.className = this.className
			return span
		}

		eq(other: TextWidget) {
			return other.text === this.text && other.className === this.className
		}

		ignoreEvent() {
			return false
		}
	}

	function appendPortableNodes(parent: HTMLElement, nodes: readonly MarkdownPortableNode[]): void {
		for (const node of nodes) {
			if (node.type === "text") {
				parent.appendChild(document.createTextNode(node.value))
				continue
			}
			if (node.type === "container" || node.type === "span") {
				const span = document.createElement("span")
				if (node.type === "container") span.className = "markdown-semantic-container"
				else if (node.className) span.className = node.className
				appendPortableNodes(span, node.children)
				parent.appendChild(span)
				continue
			}
			if (node.type === "link") {
				const link = document.createElement("a")
				const href = sanitizeMarkdownUrl(node.href, "link")
				if (href) link.href = href
				appendPortableNodes(link, node.children)
				parent.appendChild(link)
				continue
			}
			if (node.type === "image") {
				const image = document.createElement("img")
				const src = sanitizeMarkdownUrl(node.src, "image")
				if (src) image.src = src
				image.alt = node.alt
				parent.appendChild(image)
				continue
			}
			const code = document.createElement("code")
			code.textContent = node.value
			if (node.language) code.className = `language-${node.language}`
			parent.appendChild(code)
		}
	}

	class PortableNodeWidget extends WidgetType {
		constructor(readonly nodes: readonly MarkdownPortableNode[]) {
			super()
		}

		toDOM() {
			const span = document.createElement("span")
			span.className = "markdown-semantic-widget"
			appendPortableNodes(span, this.nodes)
			return span
		}

		eq(other: PortableNodeWidget) {
			return JSON.stringify(other.nodes) === JSON.stringify(this.nodes)
		}

		ignoreEvent() {
			return false
		}
	}

	class CheckboxWidget extends WidgetType {
		constructor(
			readonly checked: boolean,
			readonly from: number,
		) {
			super()
		}

		toDOM(view: EditorRuntimeView) {
			const checkbox = document.createElement("span")
			checkbox.className = "cm-checkbox markdown-task-checkbox"
			checkbox.dataset.taskCheckbox = "true"
			checkbox.dataset.state = this.checked ? "checked" : "unchecked"
			checkbox.setAttribute("role", "checkbox")
			checkbox.setAttribute("aria-checked", this.checked ? "true" : "false")
			checkbox.tabIndex = -1

			const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg")
			icon.setAttribute("viewBox", "0 0 16 16")
			icon.setAttribute("aria-hidden", "true")
			icon.setAttribute("focusable", "false")
			icon.classList.add("markdown-task-checkbox-icon")

			const check = document.createElementNS("http://www.w3.org/2000/svg", "path")
			check.setAttribute("d", "M4.1 8.2 6.9 11 12.1 5.2")
			check.setAttribute("pathLength", "1")
			check.classList.add("markdown-task-checkbox-check")
			icon.appendChild(check)
			checkbox.appendChild(icon)

			checkbox.addEventListener("pointerdown", (event) => {
				event.preventDefault()
				event.stopPropagation()
				view.dispatch({
					changes: {
						from: this.from,
						to: this.from + 3,
						insert: this.checked ? "[ ]" : "[x]",
					},
				})
			})
			return checkbox
		}

		eq(other: CheckboxWidget) {
			return other.checked === this.checked && other.from === this.from
		}

		ignoreEvent() {
			return true
		}
	}

	class TableCellPlaceholderWidget extends WidgetType {
		constructor(readonly cell: TableCellModel) {
			super()
		}

		toDOM() {
			const cell = document.createElement("span")
			cell.className = "cm-table-cell cm-table-cell-empty"
			cell.dataset.align = this.cell.alignment
			cell.dataset.tableCell = "true"
			cell.dataset.tableCellColumnIndex = String(this.cell.columnIndex)
			cell.dataset.tableCellCursor = String(this.cell.cursor)
			cell.dataset.tableCellEmpty = "true"
			cell.dataset.tableCellRowIndex = String(this.cell.rowIndex)
			cell.dataset.tableCellContentFrom = String(this.cell.contentFrom)
			cell.dataset.tableCellContentTo = String(this.cell.contentTo)
			cell.dataset.tableCellFrom = String(this.cell.from)
			cell.dataset.tableCellSourceFrom = String(this.cell.sourceFrom)
			cell.dataset.tableCellSourceTo = String(this.cell.sourceTo)
			cell.dataset.tableCellTo = String(this.cell.to)
			cell.textContent = "\u00a0"
			return cell
		}

		eq(other: TableCellPlaceholderWidget) {
			return (
				other.cell.alignment === this.cell.alignment &&
				other.cell.cursor === this.cell.cursor &&
				other.cell.columnIndex === this.cell.columnIndex &&
				other.cell.rowIndex === this.cell.rowIndex &&
				other.cell.from === this.cell.from &&
				other.cell.to === this.cell.to
			)
		}

		ignoreEvent() {
			return false
		}
	}

	class ImageWidget extends WidgetType {
		constructor(readonly block: ImageBlock) {
			super()
		}

		toDOM(view: EditorRuntimeView) {
			const container = document.createElement("span")
			container.className = "cm-image-container"
			const image = document.createElement("img")
			image.src = this.block.src
			image.alt = this.block.alt
			image.className = "cm-image"
			image.addEventListener("error", () => {
				image.hidden = true
				const fallback = document.createElement("span")
				fallback.className = "cm-image-error"
				fallback.textContent = this.block.alt ? `Image: ${this.block.alt}` : "Image not found"
				container.appendChild(fallback)
			})
			container.appendChild(image)
			container.addEventListener("pointerdown", (event) => {
				event.preventDefault()
				revealSource(view, this.block.from)
			})
			return container
		}

		eq(other: ImageWidget) {
			return other.block.src === this.block.src && other.block.alt === this.block.alt
		}

		ignoreEvent() {
			return true
		}
	}

	class CalloutFoldWidget extends WidgetType {
		constructor(readonly blockId: string) {
			super()
		}

		toDOM(view: EditorRuntimeView) {
			const button = document.createElement("button")
			button.type = "button"
			button.className = "markdown-callout-fold"
			button.dataset.calloutToggle = "true"
			button.setAttribute("aria-label", "Collapse callout")
			button.setAttribute("aria-expanded", "true")
			const preserveSelection = (event: Event) => {
				event.preventDefault()
				event.stopPropagation()
			}
			button.addEventListener("pointerdown", preserveSelection)
			button.addEventListener("mousedown", preserveSelection)
			button.addEventListener("click", (event) => {
				preserveSelection(event)
				view.dispatch({ effects: effects.toggleCalloutCollapsed.of(this.blockId) })
			})
			return button
		}

		eq(other: CalloutFoldWidget) {
			return other.blockId === this.blockId
		}

		ignoreEvent() {
			return true
		}
	}

	class CodeBlockChromeWidget extends WidgetType {
		constructor(
			readonly code: string,
			readonly blockId: string,
			readonly language: string,
			readonly hovered: boolean,
		) {
			super()
		}

		toDOM() {
			const chrome = document.createElement("span")
			chrome.className = "cm-codeblock-chrome"
			chrome.dataset.codeblockId = this.blockId
			if (!this.hovered) {
				const label = this.language.trim()
				if (label) {
					chrome.classList.add("has-language")
					const badge = document.createElement("span")
					badge.className = "cm-codeblock-language"
					badge.textContent = label
					chrome.appendChild(badge)
				}
				return chrome
			}

			const button = document.createElement("button")
			button.type = "button"
			button.className = "cm-codeblock-copy"
			button.textContent = "Copy"
			button.title = "Copy code"
			button.dataset.codeblockId = this.blockId
			button.dataset.controlsVisible = "true"
			const preserveSelection = (event: Event) => {
				event.preventDefault()
				event.stopPropagation()
			}
			button.addEventListener("pointerdown", preserveSelection)
			button.addEventListener("mousedown", preserveSelection)
			button.addEventListener("click", async (event) => {
				preserveSelection(event)
				try {
					await navigator.clipboard.writeText(this.code)
					button.textContent = "Copied!"
					button.classList.add("copied")
					setTimeout(() => {
						button.textContent = "Copy"
						button.classList.remove("copied")
					}, 2000)
				} catch {
					button.textContent = "Copy"
				}
			})
			chrome.appendChild(button)
			return chrome
		}

		eq(other: CodeBlockChromeWidget) {
			return (
				other.code === this.code &&
				other.blockId === this.blockId &&
				other.language === this.language &&
				other.hovered === this.hovered
			)
		}

		ignoreEvent() {
			return true
		}
	}

	return {
		CalloutFoldWidget,
		CheckboxWidget,
		CodeBlockChromeWidget,
		ImageWidget,
		PortableNodeWidget,
		TableCellPlaceholderWidget,
		TextWidget,
	}
}
