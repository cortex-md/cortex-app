import {
	locateFrontmatter,
	parseFrontmatter as parsePropertyFrontmatter,
	parseYamlMapping,
	removeFrontmatterValue,
	serializeFrontmatter,
	setFrontmatterValue,
} from "@cortex/properties"

export interface Frontmatter {
	created?: string
	date?: string
	tags: string[]
	aliases: string[]
	[key: string]: unknown
}

export interface ParsedNote {
	frontmatter: Frontmatter | null
	rawYaml: string
	body: string
	hasFrontmatter: boolean
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value
		.filter((item): item is string | number => {
			return typeof item === "string" || typeof item === "number"
		})
		.map(String)
}

export function hasFrontmatter(content: string): boolean {
	return locateFrontmatter(content) !== null
}

export function parseFrontmatter(content: string): ParsedNote {
	const location = locateFrontmatter(content)
	if (!location) {
		return { frontmatter: null, rawYaml: "", body: content, hasFrontmatter: false }
	}
	const { meta, body } = parsePropertyFrontmatter(content)
	return {
		frontmatter: {
			...meta,
			created: typeof meta.created === "string" ? meta.created : undefined,
			date: typeof meta.date === "string" ? meta.date : undefined,
			tags: normalizeStringArray(meta.tags),
			aliases: normalizeStringArray(meta.aliases),
		},
		rawYaml: location.yaml,
		body,
		hasFrontmatter: true,
	}
}

export function extractYamlArray(yaml: string, field: string): string[] {
	return normalizeStringArray(parseYamlMapping(yaml)[field])
}

export function createDefaultFrontmatter(options?: {
	tags?: string[]
	created?: string
	extraFields?: Record<string, string>
}): string {
	const fields: Record<string, unknown> = {
		created: options?.created ?? new Date().toISOString(),
		...options?.extraFields,
	}
	if (options?.tags?.length) fields.tags = options.tags
	return serializeFrontmatter(fields, "")
}

export function updateFrontmatterField(
	content: string,
	field: string,
	value: string | string[],
): string {
	return setFrontmatterValue(content, field, value)
}

export function addTagToFrontmatter(content: string, tag: string): string {
	const { frontmatter } = parseFrontmatter(content)
	const existingTags = frontmatter?.tags ?? []
	if (existingTags.some((existingTag) => existingTag.toLowerCase() === tag.toLowerCase())) {
		return content
	}
	return setFrontmatterValue(content, "tags", [...existingTags, tag])
}

export function removeTagFromFrontmatter(content: string, tag: string): string {
	const { frontmatter } = parseFrontmatter(content)
	if (!frontmatter) return content
	const tags = frontmatter.tags.filter(
		(existingTag) => existingTag.toLowerCase() !== tag.toLowerCase(),
	)
	if (tags.length === frontmatter.tags.length) return content
	return tags.length > 0
		? setFrontmatterValue(content, "tags", tags)
		: removeFrontmatterValue(content, "tags")
}

export function setTagsInFrontmatter(content: string, tags: string[]): string {
	const nextTags: string[] = []
	const seenTags = new Set<string>()
	for (const tag of tags) {
		const normalizedTag = tag.trim()
		const lookupKey = normalizedTag.toLowerCase()
		if (!normalizedTag || seenTags.has(lookupKey)) continue
		seenTags.add(lookupKey)
		nextTags.push(normalizedTag)
	}
	return nextTags.length > 0
		? setFrontmatterValue(content, "tags", nextTags)
		: removeFrontmatterValue(content, "tags")
}

export function extractInlineTags(content: string): string[] {
	const matches = content.match(/#([a-zA-Z][a-zA-Z0-9_/-]*)/g)
	if (!matches) return []
	return [...new Set(matches.map((match) => match.slice(1).toLowerCase()))]
}

export function extractAllTags(content: string): string[] {
	const { frontmatter, body } = parseFrontmatter(content)
	const yamlTags = (frontmatter?.tags ?? []).map((tag) => tag.toLowerCase())
	const inlineTags = extractInlineTags(body)
	return [...new Set([...yamlTags, ...inlineTags])]
}
