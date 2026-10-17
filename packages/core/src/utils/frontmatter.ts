import {
	locateFrontmatter,
	parseFrontmatter as parsePropertyFrontmatter,
	parseYamlMapping,
	removeFrontmatterValue,
	serializeFrontmatter,
	setFrontmatterValue,
} from "@cortex/properties"
import {
	extractMarkdownInlineTags,
	findMarkdownInlineTags,
	tagMatches,
} from "@cortex/properties/tags"

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

export function parseNoteFrontmatter(content: string): ParsedNote {
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
	const { frontmatter } = parseNoteFrontmatter(content)
	const existingTags = frontmatter?.tags ?? []
	if (existingTags.some((existingTag) => existingTag.toLowerCase() === tag.toLowerCase())) {
		return content
	}
	return setFrontmatterValue(content, "tags", [...existingTags, tag])
}

export function removeTagFromFrontmatter(content: string, tag: string): string {
	const { frontmatter } = parseNoteFrontmatter(content)
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
	return extractMarkdownInlineTags(content)
}

export function collectNoteTags(meta: Record<string, unknown> | null, body: string): string[] {
	const yamlTags = normalizeStringArray(meta?.tags).map((tag) => tag.toLowerCase())
	return [...new Set([...yamlTags, ...extractInlineTags(body)])]
}

export function extractAllTags(content: string): string[] {
	const { frontmatter, body } = parseNoteFrontmatter(content)
	return collectNoteTags(frontmatter, body)
}

function renameTagValue(tag: string, oldTag: string, newTag: string): string {
	const lower = tag.toLowerCase()
	if (lower === oldTag) return newTag
	if (lower.startsWith(`${oldTag}/`)) return `${newTag}${tag.slice(oldTag.length)}`
	return tag
}

export function renameTagInContent(content: string, oldTag: string, newTag: string): string {
	const from = oldTag.trim().replace(/^#/, "").toLowerCase()
	const to = newTag.trim().replace(/^#/, "")
	if (!from || !to || from === to.toLowerCase()) return content
	const { frontmatter } = parseNoteFrontmatter(content)
	let updated = content
	const yamlTags = frontmatter?.tags ?? []
	if (yamlTags.some((tag) => renameTagValue(tag, from, to) !== tag)) {
		updated = setTagsInFrontmatter(
			updated,
			yamlTags.map((tag) => renameTagValue(tag, from, to)),
		)
	}
	const updatedBody = parseNoteFrontmatter(updated).body
	if (!updated.endsWith(updatedBody)) return updated
	let nextBody = updatedBody
	const ranges = findMarkdownInlineTags(updatedBody).filter((range) => tagMatches(range.tag, from))
	for (let index = ranges.length - 1; index >= 0; index--) {
		const range = ranges[index] as (typeof ranges)[number]
		const renamed = renameTagValue(range.tag, from, to)
		nextBody = `${nextBody.slice(0, range.from + 1)}${renamed}${nextBody.slice(range.to)}`
	}
	if (nextBody === updatedBody) return updated
	return updated.slice(0, updated.length - updatedBody.length) + nextBody
}
