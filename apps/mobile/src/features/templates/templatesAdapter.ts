import {
	createDatabase,
	type TemplateDefinition,
	type TemplateRenderContext,
	type TemplateVault,
	useTemplateSharingStore,
	useTemplateStore,
	useVaultStore,
	VAULT_FILES,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { parseFrontmatter } from "@cortex/properties"
import { getDatabasePreset } from "@cortex/properties/database"
import { useSettingsStore } from "@cortex/settings"
import { getTemplateGroups, isTeamTemplate, renderTemplate } from "@cortex/templates"
import { CalendarDays, FileText, type LucideIcon, Table2 } from "lucide-react-native"
import { useEffect, useMemo } from "react"

import { FIXTURE_TEMPLATES } from "@/features/marketplace/marketplaceFixtures"
import {
	type DatabaseTemplate,
	FIXTURE_MARKET_NOTE_TEMPLATES,
	FIXTURE_TEAM_DATABASE_TEMPLATES,
	FIXTURE_TEAM_GROUP,
	FIXTURE_TEAM_NOTE_TEMPLATES,
	MARKET_DATABASE_PRESET_IDS,
	type MarketNoteTemplate,
	type TeamTemplateMeta,
} from "@/features/templates/templatesFixtures"

export type { DatabaseTemplate, TeamTemplateMeta }

export const BLANK_TEMPLATE_FOLDER = "Inbox"

interface EntryBase {
	key: string
	name: string
	hint: string
	Icon: LucideIcon
	team: TeamTemplateMeta | null
}

export interface NoteTemplateEntry extends EntryBase {
	kind: "note"
	template: TemplateDefinition | null
	market: MarketNoteTemplate | null
}

export interface DatabaseTemplateEntry extends EntryBase {
	kind: "database"
	database: DatabaseTemplate
}

export interface BlankTemplateEntry extends EntryBase {
	kind: "blank"
}

export type TemplateEntry = NoteTemplateEntry | DatabaseTemplateEntry | BlankTemplateEntry

export interface TemplateSection {
	key: string
	title: string
	teamGroup: string | null
	entries: TemplateEntry[]
}

export interface NotePreview {
	targetFolder: string
	fileName: string
	properties: { key: string; value: string; placeholder: boolean }[]
	body: string
}

const TEAM_UPDATED_FORMAT = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" })

export function createTemplateContext(
	vault: TemplateVault,
	template: { id: string; name: string; customPlaceholders?: Record<string, string> },
	noteTitle: string,
	now = new Date(),
): TemplateRenderContext {
	return {
		now,
		vault,
		template: { id: template.id, name: template.name },
		note: { title: noteTitle },
		customPlaceholders: template.customPlaceholders,
	}
}

export function renderPattern(pattern: string, context: TemplateRenderContext): string {
	try {
		return renderTemplate(pattern, context).value.trim()
	} catch {
		return pattern
	}
}

export function getTemplateBodyFilePath(vaultPath: string, template: TemplateDefinition): string {
	return `${vaultPath}/${VAULT_FILES.templates}/${template.bodyPath}`
}

export function stripMarkdownExtension(fileName: string): string {
	return fileName.replace(/\.md$/i, "")
}

function firstName(name: string): string {
	return name.split(/\s+/)[0] ?? name
}

export function getTeamTemplateMeta(template: TemplateDefinition): TeamTemplateMeta | null {
	if (!isTeamTemplate(template)) return null
	return {
		groupName: template.remote?.group ?? FIXTURE_TEAM_GROUP,
		ownerName: template.remote?.sharedBy ?? "your team",
		updatedLabel: TEAM_UPDATED_FORMAT.format(new Date(template.updatedAt)),
	}
}

function noteTemplateIcon(fileNamePattern: string): LucideIcon {
	return fileNamePattern.includes("date.") ? CalendarDays : FileText
}

function describeNoteTemplate(
	template: TemplateDefinition,
	vault: TemplateVault,
	team: TeamTemplateMeta | null,
): string {
	if (team) return `Shared by ${firstName(team.ownerName)}`
	if (template.description) return template.description
	const context = createTemplateContext(vault, template, "")
	return [
		renderPattern(template.targetFolderPattern, context),
		renderPattern(template.fileNamePattern, context),
	]
		.filter(Boolean)
		.join(" · ")
}

export function toNoteEntry(template: TemplateDefinition, vault: TemplateVault): NoteTemplateEntry {
	const team = getTeamTemplateMeta(template)
	return {
		kind: "note",
		key: `note:${template.id}`,
		name: template.name,
		hint: describeNoteTemplate(template, vault, team),
		Icon: noteTemplateIcon(template.fileNamePattern),
		team,
		template,
		market: null,
	}
}

function toDatabaseEntry(database: DatabaseTemplate): DatabaseTemplateEntry {
	return {
		kind: "database",
		key: `database:${database.id}`,
		name: database.name,
		hint: database.meta
			? `Database · shared by ${firstName(database.meta.ownerName)}`
			: `Database · ${database.preset.hint}`,
		Icon: Table2,
		team: database.meta,
		database,
	}
}

export const BLANK_TEMPLATE_ENTRY: BlankTemplateEntry = {
	kind: "blank",
	key: "blank",
	name: "Blank note",
	hint: BLANK_TEMPLATE_FOLDER,
	Icon: FileText,
	team: null,
}

export function ensureTeamTemplates(): void {
	// stub: team templates come from Cortex Sync template shares; fixtures stand in on mobile
	const { setRemoteTemplates, templates } = useTemplateStore.getState()
	if (templates.some((template) => isTeamTemplate(template))) return
	setRemoteTemplates(FIXTURE_TEAM_NOTE_TEMPLATES)
}

export function useTeamDatabaseTemplates(): DatabaseTemplate[] {
	// stub: shared database presets fall back to fixtures until template shares work on mobile
	const presets = useTemplateSharingStore((state) => state.teamDatabasePresets)
	return useMemo(() => {
		if (presets.length === 0) return FIXTURE_TEAM_DATABASE_TEMPLATES
		return presets.map((shared) => ({
			id: shared.preset.id,
			name: shared.preset.name,
			defaultName: shared.preset.name,
			defaultFolder: shared.groupName ?? "",
			meta: {
				groupName: shared.groupName ?? FIXTURE_TEAM_GROUP,
				ownerName: shared.ownerName,
				updatedLabel: "",
			},
			preset: shared.preset,
			previewRows: [],
		}))
	}, [presets])
}

export function useVaultTemplates(): {
	vault: TemplateVault | null
	templates: TemplateDefinition[]
	loading: boolean
} {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const vaultName = useVaultStore((state) => state.vault?.name ?? null)
	const templates = useTemplateStore((state) => state.templates)
	const loading = useTemplateStore((state) => state.loading)
	const vault = useMemo(
		() => (vaultPath && vaultName ? { name: vaultName, path: vaultPath } : null),
		[vaultName, vaultPath],
	)

	useEffect(() => {
		if (!vault) return
		void useTemplateStore.getState().ensureTemplatesLoaded(vault).then(ensureTeamTemplates)
	}, [vault])

	return { loading, templates, vault }
}

function matchesQuery(name: string, query: string): boolean {
	return name.toLocaleLowerCase().includes(query)
}

export function useTemplateSections(query: string): {
	vault: TemplateVault | null
	sections: TemplateSection[]
} {
	const { templates, vault } = useVaultTemplates()
	const databases = useTeamDatabaseTemplates()
	const showTeam = useSettingsStore((state) => state.settings.templates.showTeam)

	const sections = useMemo<TemplateSection[]>(() => {
		if (!vault) return []
		const normalized = query.trim().toLocaleLowerCase()
		const groups = getTemplateGroups(templates, {
			includeRecent: true,
			query: normalized,
			showTeam,
		})
		const teamDatabases = showTeam
			? databases.filter((database) => !normalized || matchesQuery(database.name, normalized))
			: []
		const noteEntries = (id: string) =>
			groups.find((group) => group.id === id)?.templates.map((t) => toNoteEntry(t, vault)) ?? []
		const teamGroup =
			groups.find((group) => group.id === "team")?.templates[0]?.remote?.group ??
			teamDatabases[0]?.meta?.groupName ??
			FIXTURE_TEAM_GROUP
		const blank =
			!normalized || matchesQuery(BLANK_TEMPLATE_ENTRY.name, normalized)
				? [BLANK_TEMPLATE_ENTRY]
				: []

		if (normalized) {
			const entries = [
				...noteEntries("recent"),
				...noteEntries("team"),
				...teamDatabases.map(toDatabaseEntry),
				...noteEntries("vault"),
				...blank,
			]
			return entries.length > 0
				? [{ entries, key: "results", teamGroup: null, title: "Templates" }]
				: []
		}

		return [
			{ entries: noteEntries("recent"), key: "recent", teamGroup: null, title: "Recent" },
			{
				entries: [...noteEntries("team"), ...teamDatabases.map(toDatabaseEntry)],
				key: "team",
				teamGroup,
				title: `From ${teamGroup}`,
			},
			{ entries: [...noteEntries("vault"), ...blank], key: "all", teamGroup: null, title: "All" },
		].filter((section) => section.entries.length > 0)
	}, [databases, query, showTeam, templates, vault])

	return { sections, vault }
}

export function resolveMarketplaceEntry(
	marketplaceId: string,
	templates: TemplateDefinition[],
	vault: TemplateVault,
	teamDatabases: DatabaseTemplate[],
): TemplateEntry | null {
	// stub: marketplace templates are fixtures until remote template listings work on mobile
	const team = FIXTURE_TEAM_NOTE_TEMPLATES.find(
		(entry) => entry.definition.id === `team-${marketplaceIdToTeamId(marketplaceId)}`,
	)
	if (team) {
		const stored = templates.find((template) => template.id === team.definition.id)
		return toNoteEntry(stored ?? team.definition, vault)
	}
	if (marketplaceId === "sprint") {
		const database = teamDatabases.find((item) => item.name === "Sprint board")
		return toDatabaseEntry(database ?? FIXTURE_TEAM_DATABASE_TEMPLATES[0])
	}
	const market = FIXTURE_MARKET_NOTE_TEMPLATES.find((item) => item.id === marketplaceId)
	if (market) {
		const installed = templates.find(
			(template) => !isTeamTemplate(template) && template.name === market.name,
		)
		if (installed) return toNoteEntry(installed, vault)
		return {
			kind: "note",
			key: `market:${market.id}`,
			name: market.name,
			hint: market.targetFolderPattern,
			Icon: noteTemplateIcon(market.fileNamePattern),
			team: null,
			template: null,
			market,
		}
	}
	const listing = FIXTURE_TEMPLATES.find((item) => item.id === marketplaceId)
	const presetId = MARKET_DATABASE_PRESET_IDS[marketplaceId]
	if (!listing || !presetId) return null
	const preset = getDatabasePreset(presetId)
	return toDatabaseEntry({
		id: `market-${listing.id}`,
		name: listing.name,
		defaultName: listing.name,
		defaultFolder: listing.destination?.split(" / ").slice(1).join("/") ?? "",
		meta: null,
		preset: { ...preset, id: `market-${listing.id}`, name: listing.name },
		previewRows: listing.preview.map(([name, status]) => ({ name, status })),
	})
}

function marketplaceIdToTeamId(marketplaceId: string): string {
	return marketplaceId === "review" ? "design-review" : marketplaceId
}

export async function loadNoteTemplateSource(
	vault: TemplateVault,
	entry: NoteTemplateEntry,
): Promise<{ body: string; fileNamePattern: string; targetFolderPattern: string }> {
	if (entry.template) {
		await useTemplateStore.getState().ensureTemplatesLoaded(vault)
		if (entry.team) ensureTeamTemplates()
		const body = await useTemplateStore.getState().readTemplateBody(vault, entry.template.id)
		return {
			body,
			fileNamePattern: entry.template.fileNamePattern,
			targetFolderPattern: entry.template.targetFolderPattern,
		}
	}
	const market = entry.market
	return {
		body: market?.body ?? "",
		fileNamePattern: market?.fileNamePattern ?? "{{ note.title }}",
		targetFolderPattern: market?.targetFolderPattern ?? "",
	}
}

export function renderNotePreview(
	vault: TemplateVault,
	entry: NoteTemplateEntry,
	source: { body: string; fileNamePattern: string; targetFolderPattern: string },
	noteTitle: string,
): NotePreview {
	const context = createTemplateContext(
		vault,
		entry.template ?? { id: entry.key, name: entry.name },
		noteTitle || entry.name,
	)
	const raw = parseFrontmatter(source.body)
	const rendered = parseFrontmatter(renderPattern(source.body, context))
	return {
		targetFolder: renderPattern(source.targetFolderPattern, context),
		fileName: stripMarkdownExtension(
			renderPattern(source.fileNamePattern, context) || noteTitle || "Untitled",
		),
		properties: Object.entries(rendered.meta).map(([key, value]) => ({
			key,
			placeholder: String(raw.meta[key] ?? "").includes("{{"),
			value: formatPropertyValue(value),
		})),
		body: rendered.body,
	}
}

function formatPropertyValue(value: unknown): string {
	if (value === null || value === undefined || value === "") return ""
	if (Array.isArray(value)) return value.map(String).join(", ")
	return String(value)
}

export interface CreateFromTemplateInput {
	title: string
	folder: string
	fileName: string
}

export type CreatedFromTemplate =
	| { kind: "note"; path: string }
	| { kind: "database"; path: string }

function joinVaultPath(vaultPath: string, folder: string): string {
	const trimmed = folder.trim().replace(/^\/+|\/+$/g, "")
	return trimmed ? `${vaultPath}/${trimmed}` : vaultPath
}

async function ensureFolder(path: string): Promise<void> {
	await getPlatform()
		.fs.createDir(path)
		.catch(() => undefined)
}

async function installMarketNoteTemplate(
	vault: TemplateVault,
	market: MarketNoteTemplate,
): Promise<TemplateDefinition> {
	// stub: marketplace bodies are fixtures; installing writes a regular vault template
	return useTemplateStore.getState().createTemplate(vault, {
		askName: true,
		body: market.body,
		fileNamePattern: market.fileNamePattern,
		name: market.name,
		targetFolderPattern: market.targetFolderPattern,
	})
}

export async function createFromTemplateEntry(
	vault: TemplateVault,
	entry: TemplateEntry,
	input: CreateFromTemplateInput,
): Promise<CreatedFromTemplate> {
	const parentPath = joinVaultPath(vault.path, input.folder)
	const vaultStore = useVaultStore.getState()

	if (entry.kind === "database") {
		const created = await createDatabase({
			name: input.title.trim() || entry.database.defaultName,
			parentPath,
			preset: entry.database.preset,
		})
		await vaultStore.refreshFiles()
		return { kind: "database", path: created.folderPath }
	}

	await ensureFolder(parentPath)

	if (entry.kind === "blank") {
		const path = await vaultStore.createFile(parentPath, input.fileName.trim() || "Untitled")
		return { kind: "note", path }
	}

	if (entry.team) ensureTeamTemplates()
	const template =
		entry.template ?? (entry.market ? await installMarketNoteTemplate(vault, entry.market) : null)
	if (!template) throw new Error(`“${entry.name}” is not available`)
	const path = await useTemplateStore.getState().createNoteFromTemplate(vault, {
		fileName: input.fileName.trim() || undefined,
		noteTitle: input.title.trim() || undefined,
		targetFolder: input.folder.trim(),
		templateId: template.id,
	})
	await vaultStore.refreshFiles()
	return { kind: "note", path }
}
