export interface TemplateDefinition {
	id: string
	name: string
	description?: string
	bodyPath: string
	targetFolderPattern: string
	fileNamePattern: string
	customPlaceholders?: Record<string, string>
	askName?: boolean
	source?: TemplateSource
	remote?: TemplateRemoteInfo
	lastUsedAt?: string
	createdAt: string
	updatedAt: string
}

export type TemplateSource = "vault" | "team" | "link" | "market"

export interface TemplateRemoteInfo {
	id: string
	version: number
	sharedBy?: string
	group?: string
}

export interface TemplateManifest {
	version: 1
	templates: TemplateDefinition[]
}

export interface TemplateRenderContext {
	now: Date
	vault: {
		name: string
		path: string
	}
	note: {
		title: string
		fileName?: string
		folder?: string
	}
	template: {
		id: string
		name: string
	}
	customPlaceholders?: Record<string, string>
}

export interface TemplateRenderResult {
	value: string
	usedPlaceholders: string[]
}

export interface TemplatePlaceholder {
	name: string
	label: string
	description: string
	example: string
}

interface RenderState {
	usedPlaceholders: Set<string>
	activeCustomPlaceholders: Set<string>
	depth: number
}

type TemplateValue = Date | string | number | boolean | null | undefined

const placeholderPattern = /\{\{\s*([^{}]+?)\s*\}\}/g
const maxCustomPlaceholderDepth = 8

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function assertString(value: unknown, field: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Template manifest field "${field}" must be a non-empty string`)
	}
	return value
}

function assertOptionalString(value: unknown, field: string): string | undefined {
	if (value === undefined) return undefined
	if (typeof value !== "string") {
		throw new Error(`Template manifest field "${field}" must be a string`)
	}
	return value
}

function normalizeTemplateBodyPath(value: string): string {
	const path = value.trim().replaceAll("\\", "/")
	const segments = path.split("/").filter((segment) => segment.length > 0 && segment !== ".")
	if (
		segments.length === 0 ||
		path.startsWith("/") ||
		/^[a-zA-Z]:\//.test(path) ||
		segments.includes("..")
	) {
		throw new Error('Template manifest field "bodyPath" must be a safe relative path')
	}
	return segments.join("/")
}

function validateCustomPlaceholders(value: unknown): Record<string, string> | undefined {
	if (value === undefined) return undefined
	if (!isRecord(value)) throw new Error("Template customPlaceholders must be an object")
	const customPlaceholders: Record<string, string> = {}
	for (const [key, expression] of Object.entries(value)) {
		if (!key.trim()) throw new Error("Template custom placeholder names cannot be empty")
		if (typeof expression !== "string") {
			throw new Error(`Template custom placeholder "${key}" must be a string`)
		}
		customPlaceholders[key] = expression
	}
	return customPlaceholders
}

const templateSources: TemplateSource[] = ["vault", "team", "link", "market"]

function validateSource(value: unknown): TemplateSource | undefined {
	if (value === undefined) return undefined
	if (!templateSources.includes(value as TemplateSource)) {
		throw new Error('Template manifest field "source" is not supported')
	}
	return value as TemplateSource
}

function validateRemote(value: unknown): TemplateRemoteInfo | undefined {
	if (value === undefined) return undefined
	if (!isRecord(value)) throw new Error('Template manifest field "remote" must be an object')
	if (typeof value.version !== "number") {
		throw new Error('Template manifest field "remote.version" must be a number')
	}
	return {
		id: assertString(value.id, "remote.id"),
		version: value.version,
		sharedBy: assertOptionalString(value.sharedBy, "remote.sharedBy"),
		group: assertOptionalString(value.group, "remote.group"),
	}
}

function validateTemplateDefinition(value: unknown): TemplateDefinition {
	if (!isRecord(value)) throw new Error("Template definitions must be objects")
	return {
		id: assertString(value.id, "id"),
		name: assertString(value.name, "name"),
		description: assertOptionalString(value.description, "description"),
		bodyPath: normalizeTemplateBodyPath(assertString(value.bodyPath, "bodyPath")),
		targetFolderPattern:
			assertOptionalString(value.targetFolderPattern, "targetFolderPattern") ?? "",
		fileNamePattern:
			assertOptionalString(value.fileNamePattern, "fileNamePattern") ?? "{{ note.title }}",
		customPlaceholders: validateCustomPlaceholders(value.customPlaceholders),
		askName: typeof value.askName === "boolean" ? value.askName : undefined,
		source: validateSource(value.source),
		remote: validateRemote(value.remote),
		lastUsedAt: assertOptionalString(value.lastUsedAt, "lastUsedAt"),
		createdAt: assertString(value.createdAt, "createdAt"),
		updatedAt: assertString(value.updatedAt, "updatedAt"),
	}
}

export function validateTemplateManifest(value: unknown): TemplateManifest {
	if (!isRecord(value)) throw new Error("Template manifest must be an object")
	if (value.version !== 1) throw new Error("Template manifest version must be 1")
	if (!Array.isArray(value.templates))
		throw new Error("Template manifest templates must be an array")
	const ids = new Set<string>()
	const templates = value.templates.map(validateTemplateDefinition)
	for (const template of templates) {
		if (ids.has(template.id)) throw new Error(`Duplicate template id "${template.id}"`)
		ids.add(template.id)
	}
	return { version: 1, templates }
}

function pad(value: number, size = 2): string {
	return String(value).padStart(size, "0")
}

function getIsoWeek(date: Date): number {
	const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
	const day = copy.getUTCDay() || 7
	copy.setUTCDate(copy.getUTCDate() + 4 - day)
	const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1))
	return Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function formatTemplateDate(value: Date, pattern: string): string {
	const replacements: Record<string, string> = {
		yyyy: String(value.getFullYear()),
		yy: String(value.getFullYear()).slice(-2),
		MM: pad(value.getMonth() + 1),
		M: String(value.getMonth() + 1),
		dd: pad(value.getDate()),
		d: String(value.getDate()),
		HH: pad(value.getHours()),
		H: String(value.getHours()),
		mm: pad(value.getMinutes()),
		m: String(value.getMinutes()),
		ss: pad(value.getSeconds()),
		s: String(value.getSeconds()),
		ww: pad(getIsoWeek(value)),
		w: String(getIsoWeek(value)),
	}
	return pattern.replace(/yyyy|yy|MM|M|dd|d|HH|H|mm|m|ss|s|ww|w/g, (token) => {
		return replacements[token] ?? token
	})
}

function coerceDate(value: TemplateValue): Date {
	if (value instanceof Date) return value
	if (typeof value === "string" || typeof value === "number") {
		const date = new Date(value)
		if (!Number.isNaN(date.getTime())) return date
	}
	throw new Error(`Cannot format "${String(value)}" as a date`)
}

function coerceString(value: TemplateValue): string {
	if (value === null || value === undefined) return ""
	if (value instanceof Date) return value.toISOString()
	return String(value)
}

function slugify(value: TemplateValue): string {
	return coerceString(value)
		.trim()
		.toLocaleLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
}

function titleCase(value: TemplateValue): string {
	return coerceString(value).replace(/\S+/g, (word) => {
		return `${word.slice(0, 1).toLocaleUpperCase()}${word.slice(1).toLocaleLowerCase()}`
	})
}

function splitOutsideSyntax(value: string, separator: string): string[] {
	const parts: string[] = []
	let current = ""
	let quote: string | null = null
	let depth = 0
	for (let index = 0; index < value.length; index++) {
		const char = value[index]
		const previous = value[index - 1]
		if (quote) {
			current += char
			if (char === quote && previous !== "\\") quote = null
			continue
		}
		if (char === '"' || char === "'") {
			quote = char
			current += char
			continue
		}
		if (char === "(") depth++
		if (char === ")") depth--
		if (char === separator && depth === 0) {
			parts.push(current.trim())
			current = ""
			continue
		}
		current += char
	}
	parts.push(current.trim())
	return parts
}

function parseFilter(segment: string): { name: string; args: string[] } {
	const match = /^([a-zA-Z][\w-]*)(?:\((.*)\))?$/.exec(segment.trim())
	if (!match) throw new Error(`Invalid template filter "${segment}"`)
	const args = match[2] === undefined || match[2].trim() === "" ? [] : parseArguments(match[2])
	return { name: match[1], args }
}

function parseArguments(value: string): string[] {
	return splitOutsideSyntax(value, ",").map((part) => {
		const trimmed = part.trim()
		const quote = trimmed[0]
		if (
			(quote === '"' || quote === "'") &&
			trimmed[trimmed.length - 1] === quote &&
			trimmed.length >= 2
		) {
			return trimmed
				.slice(1, -1)
				.replaceAll(`\\${quote}`, quote)
				.replaceAll("\\n", "\n")
				.replaceAll("\\t", "\t")
		}
		return trimmed
	})
}

function createBaseValues(context: TemplateRenderContext): Record<string, TemplateValue> {
	const today = formatTemplateDate(context.now, "yyyy-MM-dd")
	return {
		now: context.now,
		"date.today": today,
		"date.year": formatTemplateDate(context.now, "yyyy"),
		"date.month": formatTemplateDate(context.now, "MM"),
		"date.day": formatTemplateDate(context.now, "dd"),
		"date.week": formatTemplateDate(context.now, "ww"),
		"note.title": context.note.title,
		"note.fileName": context.note.fileName ?? "",
		"note.folder": context.note.folder ?? "",
		"vault.name": context.vault.name,
		"vault.path": context.vault.path,
		"template.name": context.template.name,
	}
}

function resolvePlaceholder(
	name: string,
	context: TemplateRenderContext,
	state: RenderState,
): TemplateValue {
	const baseValues = createBaseValues(context)
	if (Object.hasOwn(baseValues, name)) {
		state.usedPlaceholders.add(name)
		return baseValues[name]
	}

	const customExpression = context.customPlaceholders?.[name]
	if (customExpression === undefined) {
		state.usedPlaceholders.add(name)
		return ""
	}
	if (state.depth >= maxCustomPlaceholderDepth || state.activeCustomPlaceholders.has(name)) {
		throw new Error(`Template custom placeholder "${name}" is recursive`)
	}

	state.usedPlaceholders.add(name)
	const nextState: RenderState = {
		usedPlaceholders: state.usedPlaceholders,
		activeCustomPlaceholders: new Set([...state.activeCustomPlaceholders, name]),
		depth: state.depth + 1,
	}
	return customExpression.includes("{{")
		? renderTemplateInternal(customExpression, context, nextState).value
		: renderTemplateExpressionInternal(customExpression, context, nextState)
}

function applyFilter(value: TemplateValue, name: string, args: string[]): TemplateValue {
	if (name === "date") return formatTemplateDate(coerceDate(value), args[0] ?? "yyyy-MM-dd")
	if (name === "slug") return slugify(value)
	if (name === "lower") return coerceString(value).toLocaleLowerCase()
	if (name === "upper") return coerceString(value).toLocaleUpperCase()
	if (name === "title") return titleCase(value)
	if (name === "trim") return coerceString(value).trim()
	if (name === "default") {
		const text = coerceString(value)
		return text.trim() ? text : (args[0] ?? "")
	}
	if (name === "replace") {
		const [from = "", to = ""] = args
		return coerceString(value).replaceAll(from, to)
	}
	throw new Error(`Unknown template filter "${name}"`)
}

function createRenderState(state?: RenderState): RenderState {
	return (
		state ?? {
			usedPlaceholders: new Set<string>(),
			activeCustomPlaceholders: new Set<string>(),
			depth: 0,
		}
	)
}

function renderTemplateExpressionInternal(
	expression: string,
	context: TemplateRenderContext,
	state?: RenderState,
): string {
	const renderState = createRenderState(state)
	const segments = splitOutsideSyntax(expression, "|").filter(Boolean)
	if (segments.length === 0) throw new Error("Template expression cannot be empty")
	let value = resolvePlaceholder(segments[0], context, renderState)
	for (const segment of segments.slice(1)) {
		const filter = parseFilter(segment)
		value = applyFilter(value, filter.name, filter.args)
	}
	return coerceString(value)
}

export function renderTemplateExpression(
	expression: string,
	context: TemplateRenderContext,
): string {
	return renderTemplateExpressionInternal(expression, context)
}

function renderTemplateInternal(
	source: string,
	context: TemplateRenderContext,
	state?: RenderState,
): TemplateRenderResult {
	const renderState = createRenderState(state)
	const value = source.replace(placeholderPattern, (_match, expression: string) => {
		return renderTemplateExpressionInternal(expression, context, renderState)
	})
	return {
		value,
		usedPlaceholders: Array.from(renderState.usedPlaceholders),
	}
}

export function renderTemplate(
	source: string,
	context: TemplateRenderContext,
): TemplateRenderResult {
	return renderTemplateInternal(source, context)
}

export function getDefaultTemplatePlaceholders(
	context?: Partial<TemplateRenderContext>,
): TemplatePlaceholder[] {
	const now = context?.now ?? new Date("2026-01-02T03:04:05.000Z")
	const templateContext: TemplateRenderContext = {
		now,
		vault: {
			name: context?.vault?.name ?? "Workspace",
			path: context?.vault?.path ?? "/vault",
		},
		note: {
			title: context?.note?.title ?? "Project Plan",
			fileName: context?.note?.fileName ?? "project-plan.md",
			folder: context?.note?.folder ?? "Projects",
		},
		template: {
			id: context?.template?.id ?? "template",
			name: context?.template?.name ?? "Meeting note",
		},
		customPlaceholders: context?.customPlaceholders,
	}

	const definitions: Omit<TemplatePlaceholder, "example">[] = [
		{ name: "now", label: "Now", description: "Current timestamp." },
		{ name: "date.today", label: "Today", description: "Current date as yyyy-MM-dd." },
		{ name: "date.year", label: "Year", description: "Current four-digit year." },
		{ name: "date.month", label: "Month", description: "Current two-digit month." },
		{ name: "date.day", label: "Day", description: "Current two-digit day." },
		{ name: "date.week", label: "Week", description: "Current ISO week number." },
		{ name: "note.title", label: "Note title", description: "Title chosen for the new note." },
		{ name: "note.fileName", label: "File name", description: "Generated Markdown filename." },
		{ name: "note.folder", label: "Folder", description: "Generated note folder." },
		{ name: "vault.name", label: "Vault name", description: "Current vault name." },
		{ name: "vault.path", label: "Vault path", description: "Current vault path." },
		{ name: "template.name", label: "Template name", description: "Current template name." },
	]

	return definitions.map((definition) => ({
		...definition,
		example: renderTemplateExpression(definition.name, templateContext),
	}))
}

export interface TemplateValueOption {
	expression: string
	label: string
	example: string
}

export interface TemplateValueGroup {
	id: "dates" | "note" | "vault" | "custom"
	label: string
	options: TemplateValueOption[]
}

const templateValueDefinitions: Array<{
	group: TemplateValueGroup["id"]
	expression: string
	label: string
}> = [
	{ group: "dates", expression: "date.today", label: "Today" },
	{ group: "dates", expression: "date.week", label: "Week number" },
	{ group: "dates", expression: "date.year", label: "Year" },
	{ group: "dates", expression: 'now | date("HH:mm")', label: "Time now" },
	{ group: "note", expression: "note.title", label: "Note name" },
	{ group: "note", expression: "note.folder", label: "Folder" },
	{ group: "vault", expression: "vault.name", label: "Vault name" },
]

const templateValueGroupLabels: Record<Exclude<TemplateValueGroup["id"], "custom">, string> = {
	dates: "Dates",
	note: "The new note",
	vault: "Vault",
}

function normalizeExpression(expression: string): string {
	return expression
		.replace(/\s+/g, " ")
		.replace(/\s*\|\s*/g, " | ")
		.trim()
}

export function getTemplateValueLabel(expression: string): string {
	const normalized = normalizeExpression(expression)
	const match = templateValueDefinitions.find(
		(definition) => normalizeExpression(definition.expression) === normalized,
	)
	if (match) return match.label
	const placeholder = getDefaultTemplatePlaceholders().find((item) => item.name === normalized)
	return placeholder?.label ?? normalized
}

export function getTemplateValueGroups(context: TemplateRenderContext): TemplateValueGroup[] {
	const custom = Object.keys(context.customPlaceholders ?? {}).map((name) => ({
		expression: name,
		label: name,
		example: safeRenderExpression(name, context),
	}))
	const builtIn = (
		Object.keys(templateValueGroupLabels) as Array<Exclude<TemplateValueGroup["id"], "custom">>
	).map((id) => ({
		id,
		label: templateValueGroupLabels[id],
		options: templateValueDefinitions
			.filter((definition) => definition.group === id)
			.map((definition) => ({
				expression: definition.expression,
				label: definition.label,
				example: safeRenderExpression(definition.expression, context),
			})),
	}))
	return custom.length > 0
		? [...builtIn, { id: "custom" as const, label: "Custom", options: custom }]
		: builtIn
}

export type CustomValueSource = "date" | "time" | "note.title" | "note.folder" | "vault.name"

export type CustomValueTransform = "none" | "lower" | "upper" | "title" | "slug"

export interface CustomValueSpec {
	source: CustomValueSource
	format: string
	transform: CustomValueTransform
	fallback: string
}

const customValueSourceExpressions: Record<Exclude<CustomValueSource, "date" | "time">, string> = {
	"note.title": "note.title",
	"note.folder": "note.folder",
	"vault.name": "vault.name",
}

function quoteArgument(value: string): string {
	return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
}

export function createCustomValueExpression(spec: CustomValueSpec): string {
	const segments: string[] = []
	if (spec.source === "date" || spec.source === "time") {
		const format = spec.format.trim() || (spec.source === "date" ? "yyyy-MM-dd" : "HH:mm")
		segments.push("now", `date(${quoteArgument(format)})`)
	} else {
		segments.push(customValueSourceExpressions[spec.source])
		if (spec.transform !== "none") segments.push(spec.transform)
	}
	if (spec.fallback.trim()) segments.push(`default(${quoteArgument(spec.fallback.trim())})`)
	return segments.join(" | ")
}

export function parseCustomValueExpression(expression: string): CustomValueSpec | null {
	let parts: string[]
	try {
		parts = splitOutsideSyntax(expression, "|").filter(Boolean)
	} catch {
		return null
	}
	if (parts.length === 0) return null
	const [head, ...filters] = parts
	const parsed = filters.map((segment) => {
		try {
			return parseFilter(segment)
		} catch {
			return null
		}
	})
	if (parsed.some((filter) => filter === null)) return null
	const list = parsed as Array<{ name: string; args: string[] }>
	const fallbackFilter = list.at(-1)?.name === "default" ? list.pop() : undefined
	const fallback = fallbackFilter?.args[0] ?? ""
	if (head === "now" || head === "date.today") {
		if (list.length !== 1 || list[0].name !== "date") return null
		const format = list[0].args[0] ?? "yyyy-MM-dd"
		const isTime = /[Hhms]/.test(format) && !/[yMdw]/.test(format)
		return { source: isTime ? "time" : "date", format, transform: "none", fallback }
	}
	const source = (Object.keys(customValueSourceExpressions) as CustomValueSource[]).find(
		(key) => key === head,
	)
	if (!source || list.length > 1) return null
	const transform = (list[0]?.name ?? "none") as CustomValueTransform
	if (!["none", "lower", "upper", "title", "slug"].includes(transform)) return null
	return { source, format: "", transform, fallback }
}

export function isValidCustomValueName(name: string): boolean {
	return (
		/^[A-Za-z][\w-]*$/.test(name) && !Object.hasOwn(createBaseValues(defaultNameCheckContext), name)
	)
}

const defaultNameCheckContext: TemplateRenderContext = {
	now: new Date(0),
	vault: { name: "", path: "" },
	note: { title: "" },
	template: { id: "", name: "" },
}

function safeRenderExpression(expression: string, context: TemplateRenderContext): string {
	try {
		return renderTemplateExpression(expression, context)
	} catch {
		return ""
	}
}

export function renderTemplateValue(expression: string, context: TemplateRenderContext): string {
	return safeRenderExpression(expression, context)
}

export function getFileNameParts(pattern: string): string[] | null {
	const trimmed = pattern.trim()
	if (!trimmed) return []
	const parts: string[] = []
	const rest = trimmed.replace(placeholderPattern, (_match, expression: string) => {
		parts.push(normalizeExpression(expression))
		return " "
	})
	return rest.trim() ? null : parts
}

export function createFileNamePattern(parts: string[]): string {
	return parts.map((part) => `{{ ${part} }}`).join(" ")
}

export interface TemplateSegment {
	kind: "text" | "value"
	value: string
}

export function splitTemplateSegments(source: string): TemplateSegment[] {
	const segments: TemplateSegment[] = []
	let cursor = 0
	for (const match of source.matchAll(placeholderPattern)) {
		const index = match.index ?? 0
		if (index > cursor) segments.push({ kind: "text", value: source.slice(cursor, index) })
		segments.push({ kind: "value", value: normalizeExpression(match[1]) })
		cursor = index + match[0].length
	}
	if (cursor < source.length) segments.push({ kind: "text", value: source.slice(cursor) })
	return segments
}

export function createTemplateBodyFromNote(body: string): string {
	const lines = body.split(/\r?\n/)
	const kept: string[] = []
	let inFence = false
	for (const line of lines) {
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence
			continue
		}
		if (inFence) continue
		if (/^#{1,6}\s+\S/.test(line)) {
			if (kept.length > 0) kept.push("")
			kept.push(line.trimEnd(), "")
		}
	}
	return kept.length > 0 ? `${kept.join("\n").trimEnd()}\n` : ""
}

export interface TemplateBundleData {
	format: 1
	kind: "note" | "database"
	files: Array<{ path: string; content: string }>
}

export interface NoteTemplateBundleFields {
	name: string
	description?: string
	targetFolderPattern: string
	fileNamePattern: string
	askName?: boolean
	customPlaceholders?: Record<string, string>
}

const noteTemplateMetaPath = "template.json"
const noteTemplateBodyPath = "template.md"

export function createNoteTemplateBundle(
	fields: NoteTemplateBundleFields,
	body: string,
): TemplateBundleData {
	const meta: NoteTemplateBundleFields = {
		name: fields.name,
		description: fields.description ?? "",
		targetFolderPattern: fields.targetFolderPattern,
		fileNamePattern: fields.fileNamePattern,
		askName: fields.askName ?? true,
		customPlaceholders: fields.customPlaceholders ?? {},
	}
	return {
		format: 1,
		kind: "note",
		files: [
			{ path: noteTemplateMetaPath, content: JSON.stringify(meta, null, 2) },
			{ path: noteTemplateBodyPath, content: body },
		],
	}
}

export function readNoteTemplateBundle(
	bundle: TemplateBundleData,
): { fields: NoteTemplateBundleFields; body: string } | null {
	if (bundle.kind !== "note") return null
	const metaFile = bundle.files.find((file) => file.path === noteTemplateMetaPath)
	const bodyFile = bundle.files.find((file) => file.path === noteTemplateBodyPath)
	if (!metaFile || !bodyFile) return null
	try {
		const raw = JSON.parse(metaFile.content) as Record<string, unknown>
		if (typeof raw.name !== "string" || !raw.name.trim()) return null
		return {
			fields: {
				name: raw.name,
				description: typeof raw.description === "string" ? raw.description : "",
				targetFolderPattern:
					typeof raw.targetFolderPattern === "string" ? raw.targetFolderPattern : "",
				fileNamePattern:
					typeof raw.fileNamePattern === "string" ? raw.fileNamePattern : "{{ note.title }}",
				askName: typeof raw.askName === "boolean" ? raw.askName : true,
				customPlaceholders: validateCustomPlaceholders(raw.customPlaceholders) ?? {},
			},
			body: bodyFile.content,
		}
	} catch {
		return null
	}
}

export { getTeamLabel, getTemplateGroups, isTeamTemplate, type TemplateGroup } from "./groups"
