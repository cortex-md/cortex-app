import { getNoteTitle, isMarkdownPath, joinPath, normalizePath } from "@cortex/platform/utils"
import type { ObsidianConfig } from "./config"
import { addFinding, type ObsidianFindings } from "./findings"

export type AttachmentLocation = "root" | "same" | "custom"

export interface VaultSettingsImport {
	attachments?: { location: AttachmentLocation; customPath: string }
	dailyNotes?: { folder: string; format: string; templateName?: string }
	templates: { name: string; body: string }[]
	bookmarks: string[]
	propertyTypes: { key: string; type: string }[]
}

export interface ObsidianSettingsContext {
	destinationRelativePath: string
	resolveTargetPath: (sourceRelativePath: string) => string | null
	templateBodies: ReadonlyMap<string, string>
}

const DEFAULT_DATE_FORMAT = "yyyy-MM-dd"
const DEFAULT_TIME_FORMAT = "HH:mm"
const MOMENT_TOKENS: Record<string, string> = {
	YYYY: "yyyy",
	YY: "yy",
	MM: "MM",
	M: "M",
	DD: "dd",
	D: "d",
	HH: "HH",
	H: "H",
	mm: "mm",
	m: "m",
	ss: "ss",
	s: "s",
	WW: "ww",
	W: "w",
}
const MOMENT_TOKEN_PATTERN = /YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s|WW|W|[A-Za-z]|[^A-Za-z]+/gu
const PROPERTY_TYPES: Record<string, string> = {
	text: "text",
	number: "number",
	checkbox: "checkbox",
	date: "date",
}
const DEFAULT_OBSIDIAN_PROPERTY_KEYS = new Set(["aliases", "cssclasses", "tags"])
const TEMPLATE_PLACEHOLDER_PATTERN = /\{\{\s*(title|date|time)(?::([^}]*))?\s*\}\}/giu

export function convertMomentFormat(format: string): string | null {
	let converted = ""
	for (const [token] of format.matchAll(MOMENT_TOKEN_PATTERN)) {
		const mapped = MOMENT_TOKENS[token]
		if (mapped) converted += mapped
		else if (/^[A-Za-z]$/u.test(token)) return null
		else converted += token
	}
	return converted || null
}

function readString(record: Record<string, unknown> | null, key: string): string | undefined {
	const value = record?.[key]
	return typeof value === "string" ? value : undefined
}

function trimSlashes(path: string): string {
	return normalizePath(path.trim()).replace(/^\/+|\/+$/gu, "")
}

function joinRelative(base: string, path: string): string {
	const relativePath = trimSlashes(path)
	if (!base) return relativePath
	return relativePath ? joinPath(base, relativePath) : base
}

function convertFormat(
	format: string | undefined,
	fallback: string,
	findings: ObsidianFindings,
): string {
	if (!format?.trim()) return fallback
	const converted = convertMomentFormat(format.trim())
	if (converted) return converted
	addFinding(findings, "date-format", format)
	return fallback
}

export function convertObsidianTemplate(
	body: string,
	config: ObsidianConfig,
	findings: ObsidianFindings,
): string {
	const dateFormat = readString(config.templates, "dateFormat")
	const timeFormat = readString(config.templates, "timeFormat")
	return body.replace(TEMPLATE_PLACEHOLDER_PATTERN, (_match, name: string, format?: string) => {
		const placeholder = name.toLocaleLowerCase()
		if (placeholder === "title") return "{{ note.title }}"
		const pattern =
			placeholder === "date"
				? convertFormat(format ?? dateFormat, DEFAULT_DATE_FORMAT, findings)
				: convertFormat(format ?? timeFormat, DEFAULT_TIME_FORMAT, findings)
		return `{{ now | date("${pattern}") }}`
	})
}

function mapAttachments(
	config: ObsidianConfig,
	destinationRelativePath: string,
	findings: ObsidianFindings,
): VaultSettingsImport["attachments"] {
	const folder = readString(config.app, "attachmentFolderPath")?.trim() ?? "/"
	if (folder === "./" || folder === ".") return { location: "same", customPath: "" }
	if (folder.startsWith("./")) {
		addFinding(findings, "attachment-setting", folder)
		return undefined
	}
	const customPath = joinRelative(destinationRelativePath, folder === "/" ? "" : folder)
	return customPath ? { location: "custom", customPath } : { location: "root", customPath: "" }
}

export function getObsidianTemplatePaths(
	config: ObsidianConfig,
	sourcePaths: Iterable<string>,
): string[] {
	const folder = trimSlashes(readString(config.templates, "folder") ?? "")
	const dailyTemplate = readString(config.dailyNotes, "template")
	const paths = new Set<string>()
	if (folder && (config.templates || config.enabledCorePlugins.has("templates"))) {
		for (const path of sourcePaths) {
			if (isMarkdownPath(path) && path.startsWith(`${folder}/`)) paths.add(path)
		}
	}
	if (dailyTemplate?.trim()) paths.add(`${trimSlashes(dailyTemplate).replace(/\.md$/iu, "")}.md`)
	return [...paths]
}

function mapTemplates(
	config: ObsidianConfig,
	templateBodies: ReadonlyMap<string, string>,
	findings: ObsidianFindings,
): VaultSettingsImport["templates"] {
	const names = new Set<string>()
	const templates: VaultSettingsImport["templates"] = []
	for (const [path, body] of templateBodies) {
		const name = getNoteTitle(path)
		if (names.has(name.toLocaleLowerCase())) continue
		names.add(name.toLocaleLowerCase())
		templates.push({ name, body: convertObsidianTemplate(body, config, findings) })
	}
	return templates
}

function mapDailyNotes(
	config: ObsidianConfig,
	destinationRelativePath: string,
	findings: ObsidianFindings,
): VaultSettingsImport["dailyNotes"] {
	if (!config.dailyNotes && !config.enabledCorePlugins.has("daily-notes")) return undefined
	const template = readString(config.dailyNotes, "template")?.trim()
	return {
		folder: joinRelative(destinationRelativePath, readString(config.dailyNotes, "folder") ?? ""),
		format: convertFormat(readString(config.dailyNotes, "format"), DEFAULT_DATE_FORMAT, findings),
		templateName: template ? getNoteTitle(template) : undefined,
	}
}

interface ObsidianBookmarkItem {
	type?: unknown
	path?: unknown
	title?: unknown
	query?: unknown
	url?: unknown
	items?: unknown
}

function collectBookmarks(
	items: unknown,
	context: ObsidianSettingsContext,
	findings: ObsidianFindings,
	bookmarks: string[],
): void {
	if (!Array.isArray(items)) return
	for (const item of items as ObsidianBookmarkItem[]) {
		if (item?.type === "group") {
			collectBookmarks(item.items, context, findings, bookmarks)
			continue
		}
		const path = typeof item?.path === "string" ? trimSlashes(item.path) : ""
		const targetPath = isMarkdownPath(path) ? context.resolveTargetPath(path) : null
		if (targetPath) {
			bookmarks.push(targetPath)
			continue
		}
		const label = [item?.title, item?.query, item?.url, item?.path, item?.type].find(
			(value): value is string => typeof value === "string" && value.length > 0,
		)
		addFinding(findings, "bookmark", label)
	}
}

function mapPropertyTypes(
	config: ObsidianConfig,
	findings: ObsidianFindings,
): VaultSettingsImport["propertyTypes"] {
	const types = config.types?.types
	if (!types || typeof types !== "object") return []
	return Object.entries(types as Record<string, unknown>).flatMap(([key, type]) => {
		if (DEFAULT_OBSIDIAN_PROPERTY_KEYS.has(key.toLocaleLowerCase())) return []
		const mapped = typeof type === "string" ? PROPERTY_TYPES[type] : undefined
		if (mapped) return [{ key, type: mapped }]
		addFinding(findings, "property-type", `${key}: ${String(type)}`)
		return []
	})
}

export function mapObsidianSettings(
	config: ObsidianConfig,
	context: ObsidianSettingsContext,
	findings: ObsidianFindings,
): VaultSettingsImport {
	const bookmarks: string[] = []
	collectBookmarks(config.bookmarks?.items, context, findings, bookmarks)
	for (const plugin of config.communityPlugins) addFinding(findings, "community-plugin", plugin)
	return {
		attachments: mapAttachments(config, context.destinationRelativePath, findings),
		dailyNotes: mapDailyNotes(config, context.destinationRelativePath, findings),
		templates: mapTemplates(config, context.templateBodies, findings),
		bookmarks,
		propertyTypes: mapPropertyTypes(config, findings),
	}
}
