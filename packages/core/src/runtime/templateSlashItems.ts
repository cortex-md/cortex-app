import { useSettingsStore } from "@cortex/settings"
import { useTemplateStore } from "../stores/templateStore"
import { getTeamLabel, isTeamTemplate } from "../templates"

export const TEMPLATE_SLASH_PREFIX = "template:"

export interface TemplateSlashItem {
	id: string
	label: string
	category: string
	aliases: string[]
}

export function getTemplateSlashItems(): TemplateSlashItem[] {
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
