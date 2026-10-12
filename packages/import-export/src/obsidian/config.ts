import { getPlatform } from "@cortex/platform"
import { joinPath } from "@cortex/platform/utils"

export const OBSIDIAN_CONFIG_DIR = ".obsidian"

type JsonRecord = Record<string, unknown>

export interface ObsidianConfig {
	app: JsonRecord
	dailyNotes: JsonRecord | null
	templates: JsonRecord | null
	bookmarks: JsonRecord | null
	types: JsonRecord | null
	enabledCorePlugins: Set<string>
	communityPlugins: string[]
}

const CONFIG_FILES = [
	"app.json",
	"daily-notes.json",
	"templates.json",
	"bookmarks.json",
	"types.json",
	"core-plugins.json",
	"community-plugins.json",
	"appearance.json",
	"workspace.json",
] as const

function parseJson(content: string | undefined): unknown {
	if (content === undefined) return null
	try {
		return JSON.parse(content)
	} catch {
		return null
	}
}

function asRecord(value: unknown): JsonRecord | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as JsonRecord)
		: null
}

function readEnabledPlugins(value: unknown): string[] {
	if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
	const record = asRecord(value)
	if (!record) return []
	return Object.entries(record).flatMap(([id, enabled]) => (enabled === true ? [id] : []))
}

export async function readObsidianConfig(vaultPath: string): Promise<ObsidianConfig | null> {
	const configDir = joinPath(vaultPath, OBSIDIAN_CONFIG_DIR)
	const reads = await getPlatform().fs.readTextFiles(
		CONFIG_FILES.map((fileName) => joinPath(configDir, fileName)),
	)
	if (reads.every((read) => read === null)) return null
	const [app, dailyNotes, templates, bookmarks, types, corePlugins, communityPlugins] = reads.map(
		(read) => parseJson(read?.content),
	)
	return {
		app: asRecord(app) ?? {},
		dailyNotes: asRecord(dailyNotes),
		templates: asRecord(templates),
		bookmarks: asRecord(bookmarks),
		types: asRecord(types),
		enabledCorePlugins: new Set(readEnabledPlugins(corePlugins)),
		communityPlugins: readEnabledPlugins(communityPlugins),
	}
}

export async function isObsidianVault(vaultPath: string): Promise<boolean> {
	return (await readObsidianConfig(vaultPath)) !== null
}
