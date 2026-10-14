import { useSettingsStore } from "@cortex/settings"
import { getTeamLabel, isTeamTemplate } from "@cortex/templates"
import { useTemplateStore } from "../stores/templateStore"

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
