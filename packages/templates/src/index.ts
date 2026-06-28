export interface TemplateDefinition {
	id: string
	name: string
	description?: string
	bodyPath: string
	targetFolderPattern: string
	fileNamePattern: string
	customPlaceholders?: Record<string, string>
	createdAt: string
	updatedAt: string
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

function formatDate(value: Date, pattern: string): string {
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
	const today = formatDate(context.now, "yyyy-MM-dd")
	return {
		now: context.now,
		"date.today": today,
		"date.year": formatDate(context.now, "yyyy"),
		"date.month": formatDate(context.now, "MM"),
		"date.day": formatDate(context.now, "dd"),
		"date.week": formatDate(context.now, "ww"),
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
	if (name === "date") return formatDate(coerceDate(value), args[0] ?? "yyyy-MM-dd")
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
