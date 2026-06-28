import { parse } from "yaml"

export interface FrontmatterField {
	key: string
	value: string
	values: string[]
}

export interface ParsedFrontmatter {
	from: number
	to: number
	yaml: string
	fields: FrontmatterField[]
}

function formatFrontmatterValue(value: unknown): string[] {
	if (Array.isArray(value)) return value.flatMap(formatFrontmatterValue)
	if (value === null || value === undefined) return []
	if (typeof value === "object") return [JSON.stringify(value)]
	return [String(value)]
}

export function parseFrontmatterFields(yaml: string): FrontmatterField[] {
	let parsed: unknown
	try {
		parsed = parse(yaml)
	} catch {
		return []
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return []

	return Object.entries(parsed).map(([key, value]) => {
		const values = formatFrontmatterValue(value)
		return {
			key,
			value: values.join(", "),
			values,
		}
	})
}

export function parseFrontmatter(source: string): ParsedFrontmatter | null {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
	if (!match) return null

	return {
		from: 0,
		to: match[0].length,
		yaml: match[1],
		fields: parseFrontmatterFields(match[1]),
	}
}
