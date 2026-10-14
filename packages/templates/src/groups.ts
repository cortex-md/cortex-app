import type { TemplateDefinition } from "./index"

export interface TemplateGroup {
	id: "recent" | "vault" | "team"
	label: string
	templates: TemplateDefinition[]
}

const recentLimit = 2

export function isTeamTemplate(template: TemplateDefinition): boolean {
	return template.source === "team"
}

export function getTeamLabel(templates: TemplateDefinition[]): string {
	const group = templates.find((template) => isTeamTemplate(template))?.remote?.group
	return group ? `From ${group}` : "From your team"
}

export function getTemplateGroups(
	templates: TemplateDefinition[],
	options: { includeRecent: boolean; showTeam: boolean; query?: string },
): TemplateGroup[] {
	const query = options.query?.trim().toLocaleLowerCase() ?? ""
	const visible = templates.filter(
		(template) =>
			(options.showTeam || !isTeamTemplate(template)) &&
			(!query || template.name.toLocaleLowerCase().includes(query)),
	)
	const recent =
		options.includeRecent && !query
			? visible
					.filter((template) => template.lastUsedAt)
					.sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""))
					.slice(0, recentLimit)
			: []
	const recentIds = new Set(recent.map((template) => template.id))
	const rest = visible.filter((template) => !recentIds.has(template.id))
	const groups: TemplateGroup[] = [
		{ id: "recent", label: "Recent", templates: recent },
		{
			id: "vault",
			label: options.includeRecent ? "Your templates" : "In this vault",
			templates: rest.filter((template) => !isTeamTemplate(template)),
		},
		{
			id: "team",
			label: getTeamLabel(templates),
			templates: rest.filter((template) => isTeamTemplate(template)),
		},
	]
	return groups.filter((group) => group.templates.length > 0)
}
