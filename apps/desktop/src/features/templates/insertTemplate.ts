import { useTemplateStore, useVaultStore } from "@cortex/core"
import type { SlashCommandItem } from "@cortex/editor/slash-commands"
import type { EditorRuntimeView } from "@cortex/editor/types"
import {
	getPropertiesRuntime,
	parseFrontmatter,
	removeFrontmatterValue,
	setFrontmatterValue,
} from "@cortex/properties"
import { useSettingsStore } from "@cortex/settings"
import { toast } from "@cortex/ui"
import { getTeamLabel, isTeamTemplate } from "./templateGroups"

export const TEMPLATE_SLASH_PREFIX = "template:"

export function getTemplateSlashItems(): SlashCommandItem[] {
	const templates = useTemplateStore.getState().templates
	const showTeam = useSettingsStore.getState().settings.templates.showTeam
	const teamLabel = getTeamLabel(templates)
	return templates
		.filter((template) => showTeam || !isTeamTemplate(template))
		.map((template) => ({
			id: `${TEMPLATE_SLASH_PREFIX}${template.id}`,
			label: template.name,
			category: isTeamTemplate(template) ? teamLabel : "Templates",
			aliases: ["template", "templates", template.name],
		}))
}

function getNoteTitle(filePath: string): string {
	const name = filePath.split(/[\\/]/).pop() ?? filePath
	return name.replace(/\.md$/i, "")
}

async function mergeProperties(filePath: string, properties: Record<string, unknown>) {
	const added: string[] = []
	await getPropertiesRuntime().notes.updateNote(filePath, (raw) => {
		const { meta } = parseFrontmatter(raw)
		let next = raw
		for (const [key, value] of Object.entries(properties)) {
			if (Object.hasOwn(meta, key)) continue
			next = setFrontmatterValue(next, key, value ?? "")
			added.push(key)
		}
		return next
	})
	return added
}

async function removeProperties(filePath: string, keys: string[]) {
	if (keys.length === 0) return
	await getPropertiesRuntime().notes.updateNote(filePath, (raw) =>
		keys.reduce((next, key) => removeFrontmatterValue(next, key), raw),
	)
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
