import type { Plugin } from "unified"
import { parseFrontmatterFields } from "../frontmatter"

export const remarkStripFrontmatter: Plugin = () => {
	return (tree, file) => {
		const parent = tree as unknown as { children: Array<{ type: string; value?: string }> }
		const firstChild = parent.children[0]
		if (firstChild?.type !== "yaml") return

		const fields = parseFrontmatterFields(firstChild.value ?? "")
		file.data.frontmatterFields = fields
		parent.children.shift()
	}
}
