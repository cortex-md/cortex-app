import { useTemplateStore, useVaultStore } from "@cortex/core"
import type { EditorRuntimeView } from "@cortex/editor/types"
import {
	mergeMissingNoteProperties as mergeProperties,
	removeNoteProperties as removeProperties,
} from "@cortex/properties"
import { toast } from "@cortex/ui"

export { getTemplateSlashItems, TEMPLATE_SLASH_PREFIX } from "@cortex/core"

function getNoteTitle(filePath: string): string {
	const name = filePath.split(/[\\/]/).pop() ?? filePath
	return name.replace(/\.md$/i, "")
}

export async function insertTemplateIntoNote(
	templateId: string,
	view: EditorRuntimeView,
	filePath: string,
): Promise<void> {
	const vault = useVaultStore.getState().vault
	const template = useTemplateStore.getState().templates.find((item) => item.id === templateId)
	if (!vault || !template) return
	try {
		const result = await useTemplateStore
			.getState()
			.renderTemplateForInsert(vault, templateId, getNoteTitle(filePath))
		const from = view.state.selection.main.from
		const before = from > 0 ? view.state.doc.sliceString(from - 1, from) : "\n"
		const body = `${before === "\n" ? "" : "\n"}${result.body.replace(/^\n+/, "")}`
		view.dispatch({ changes: { from, insert: body }, selection: { anchor: from + body.length } })
		view.focus()
		const added = await mergeProperties(filePath, result.properties)
		const summary = added.length > 0 ? ` · added ${added.join(", ")}` : ""
		toast(`Inserted “${template.name}”${summary}`, {
			action: {
				label: "Undo",
				onClick: () => {
					if (view.state.doc.sliceString(from, from + body.length) === body) {
						view.dispatch({ changes: { from, to: from + body.length, insert: "" } })
					}
					void removeProperties(filePath, added)
				},
			},
		})
	} catch (error) {
		toast.error(error instanceof Error ? error.message : String(error))
	}
}
