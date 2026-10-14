import type { SharedDatabasePreset } from "@cortex/core"
import type { DatabaseConfig } from "@cortex/properties/database"

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
	return (config?.templates ?? []).map((template) => ({
		body: template.body,
		id: template.id,
		name: template.name,
		properties: template.properties,
		subtitle: headingsOf(template.body),
		title: "Untitled",
	}))
}

export function listTeamDatabasePresets(
	shared: readonly SharedDatabasePreset[],
): SharedDatabasePreset[] {
	return [...shared]
}
