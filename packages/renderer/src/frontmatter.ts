import { parseYamlMapping } from "@cortex/properties/frontmatter"

export interface FrontmatterField {
	key: string
	value: string
	values: string[]
}

function formatFrontmatterValue(value: unknown): string[] {
	if (Array.isArray(value)) return value.flatMap(formatFrontmatterValue)
	if (value === null || value === undefined) return []
	if (typeof value === "object") return [JSON.stringify(value)]
	return [String(value)]
}

export function parseFrontmatterFields(yaml: string): FrontmatterField[] {
	let parsed: Record<string, unknown>
	try {
		parsed = parseYamlMapping(yaml)
	} catch {
		return []
	}
	return Object.entries(parsed).map(([key, value]) => {
		const values = formatFrontmatterValue(value)
		return { key, value: values.join(", "), values }
	})
}
