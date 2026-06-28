import type { Plugin } from "unified"
import { visit } from "unist-util-visit"
import { getRendererFeatureFlags } from "../features"

type HastElement = {
	type: string
	tagName?: string
	properties?: Record<string, unknown>
	children?: HastElement[]
	value?: string
	position?: {
		start?: {
			offset?: number
		}
	}
}

function isTaskCheckbox(node: HastElement | undefined): boolean {
	if (node?.type !== "element" || node.tagName !== "input") return false
	return node.properties?.type === "checkbox"
}

function createCheckIcon(): HastElement {
	return {
		type: "element",
		tagName: "svg",
		properties: {
			viewBox: "0 0 16 16",
			"aria-hidden": "true",
			focusable: "false",
			className: "markdown-task-checkbox-icon",
		},
		children: [
			{
				type: "element",
				tagName: "path",
				properties: {
					d: "M4.1 8.2 6.9 11 12.1 5.2",
					pathLength: 1,
					className: "markdown-task-checkbox-check",
				},
				children: [],
			},
		],
	}
}

function renderTaskCheckbox(checkbox: HastElement, checked: boolean): void {
	checkbox.tagName = "span"
	checkbox.properties = {
		role: "checkbox",
		"aria-checked": checked ? "true" : "false",
		"data-state": checked ? "checked" : "unchecked",
		"data-task-checkbox": "true",
		className: "markdown-task-checkbox",
		tabIndex: -1,
	}
	checkbox.children = [createCheckIcon()]
}

function markTaskItem(node: HastElement, checkbox: HastElement, checked: boolean): void {
	renderTaskCheckbox(checkbox, checked)

	if (!node.properties) node.properties = {}
	node.properties["data-task-item"] = checked ? "checked" : "unchecked"
	const offset = node.position?.start?.offset ?? checkbox.position?.start?.offset
	if (typeof offset === "number") node.properties["data-offset"] = offset
}

function getTaskTextState(value: string | undefined): boolean | undefined {
	if (value?.startsWith("[x] ") === true || value?.startsWith("[X] ") === true) return true
	if (value?.startsWith("[ ] ") === true) return false
	return undefined
}

function createTaskCheckbox(): HastElement {
	return {
		type: "element",
		tagName: "input",
		properties: {
			type: "checkbox",
		},
		children: [],
	}
}

export const rehypeTaskList: Plugin = () => {
	return (tree, file) => {
		if (!getRendererFeatureFlags(file).hasTaskLists) return
		visit(tree, "element", (node: HastElement) => {
			if (node.tagName !== "li") return

			const directCheckbox = node.children?.find(isTaskCheckbox)
			if (directCheckbox) {
				markTaskItem(node, directCheckbox, directCheckbox.properties?.checked === true)
				return
			}

			const firstChild = node.children?.[0]
			if (firstChild?.type === "text") {
				const checked = getTaskTextState(firstChild.value)
				if (checked === undefined) return
				firstChild.value = firstChild.value?.slice(4) ?? ""
				const checkbox = createTaskCheckbox()
				node.children = [checkbox, ...(node.children ?? [])]
				markTaskItem(node, checkbox, checked)
				return
			}

			if (firstChild?.type !== "element" || firstChild.tagName !== "p") return

			const paragraph = firstChild
			const paragraphCheckbox = paragraph.children?.find(isTaskCheckbox)
			if (paragraphCheckbox) {
				markTaskItem(node, paragraphCheckbox, paragraphCheckbox.properties?.checked === true)
				return
			}

			const textNode = paragraph.children?.[0]
			if (textNode?.type !== "text") return

			const checked = getTaskTextState(textNode.value)
			if (checked === undefined) return

			textNode.value = textNode.value?.slice(4) ?? ""
			const checkbox = createTaskCheckbox()

			paragraph.children = [checkbox, ...(paragraph.children ?? [])]
			markTaskItem(node, checkbox, checked)
		})
	}
}
