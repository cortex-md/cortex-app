import type { SharedDatabasePreset } from "@cortex/core"
import type { DatabaseConfig } from "@cortex/properties/database"

import { ROW_TEMPLATE_FIXTURES, TEAM_PRESET_FIXTURES } from "@/features/database/databaseFixtures"

export interface DatabaseRowTemplateChoice {
	id: string
	name: string
	subtitle: string
	title: string
	body?: string
	properties?: Record<string, unknown>
}

function headingsOf(body: string | undefined): string {
	return (body ?? "")
		.split("\n")
		.map((line) => /^#{1,6}\s+(.+)$/u.exec(line.trim())?.[1])
		.filter((heading): heading is string => Boolean(heading))
		.slice(0, 3)
		.join(" · ")
}

export function listDatabaseRowTemplates(
	config: DatabaseConfig | null,
): DatabaseRowTemplateChoice[] {
	// stub: without row templates in the vault config the prototype presets are offered
	const templates = config?.templates ?? []
	if (templates.length > 0) {
		return templates.map((template) => ({
			body: template.body,
			id: template.id,
			name: template.name,
			properties: template.properties,
			subtitle: headingsOf(template.body),
			title: "Untitled",
		}))
	}
	return ROW_TEMPLATE_FIXTURES.map((fixture) => ({ ...fixture }))
}

export function listTeamDatabasePresets(
	shared: readonly SharedDatabasePreset[],
): SharedDatabasePreset[] {
	// stub: fixtures stand in for team database templates until the sharing backend returns some
	if (shared.length > 0) return [...shared]
	return TEAM_PRESET_FIXTURES.map((fixture) => ({ ...fixture }))
}
