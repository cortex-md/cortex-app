import { Document, isMap, parseDocument } from "yaml"
import type { FrontmatterLocation, FrontmatterResult, PropertyMap } from "./types"

export interface RawNoteProjection {
	rawContent: string
	body: string
	meta: PropertyMap
	frontmatterError: string | null
}

export class FrontmatterParseError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "FrontmatterParseError"
	}
}

function parseYamlDocument(yaml: string): Document {
	const document = parseDocument(yaml, {
		keepSourceTokens: true,
		prettyErrors: false,
		strict: true,
	})
	if (document.errors.length > 0) {
		throw new FrontmatterParseError(document.errors[0].message)
	}
	if (document.contents !== null && !isMap(document.contents)) {
		throw new FrontmatterParseError("Frontmatter must contain a YAML mapping")
	}
	return document
}

export function locateFrontmatter(source: string): FrontmatterLocation | null {
	const lineEnding = source.includes("\r\n") ? "\r\n" : "\n"
	const openingMatch = source.match(/^---\r?\n/)
	if (!openingMatch) return null
	const openingEnd = openingMatch[0].length
	const closingPattern = /^(---|\.\.\.)\s*$/gm
	closingPattern.lastIndex = openingEnd
	const closingMatch = closingPattern.exec(source)
	if (!closingMatch) return null
	const closingLineEnd = source.indexOf(lineEnding, closingMatch.index)
	const to = closingLineEnd === -1 ? source.length : closingLineEnd + lineEnding.length
	return {
		from: 0,
		to,
		yaml: source.slice(openingEnd, closingMatch.index),
		body: source.slice(to),
		lineEnding,
	}
}

export function parseFrontmatter(raw: string): FrontmatterResult {
	const location = locateFrontmatter(raw)
	if (!location) return { meta: {}, body: raw }
	const document = parseYamlDocument(location.yaml)
	const value = document.toJS({ mapAsMap: false })
	return {
		meta: value && typeof value === "object" && !Array.isArray(value) ? (value as PropertyMap) : {},
		body: location.body,
	}
}

export function extractFrontmatterBody(raw: string): string {
	return locateFrontmatter(raw)?.body ?? raw
}

export function projectRawNote(rawContent: string): RawNoteProjection {
	try {
		const parsed = parseFrontmatter(rawContent)
		return {
			rawContent,
			body: parsed.body,
			meta: parsed.meta,
			frontmatterError: null,
		}
	} catch (error) {
		return {
			rawContent,
			body: extractFrontmatterBody(rawContent),
			meta: {},
			frontmatterError: error instanceof Error ? error.message : String(error),
		}
	}
}

export function replaceFrontmatterBody(raw: string, body: string): string {
	const location = locateFrontmatter(raw)
	return location ? `${raw.slice(0, location.to)}${body}` : body
}

export function serializeFrontmatter(meta: PropertyMap, body: string): string {
	if (Object.keys(meta).length === 0) return body
	const document = new Document(meta)
	const yaml = document.toString({ lineWidth: 0 }).trimEnd()
	return `---\n${yaml}\n---\n${body}`
}

function serializeDocument(
	document: Document,
	location: FrontmatterLocation | null,
	body: string,
): string {
	const lineEnding = location?.lineEnding ?? (body.includes("\r\n") ? "\r\n" : "\n")
	const yaml = document.toString({ lineWidth: 0 }).trimEnd().replaceAll("\n", lineEnding)
	return `---${lineEnding}${yaml}${lineEnding}---${lineEnding}${body}`
}

export function setFrontmatterValue(raw: string, key: string, value: unknown): string {
	const location = locateFrontmatter(raw)
	const document = location ? parseYamlDocument(location.yaml) : new Document({})
	document.set(key, value)
	return serializeDocument(document, location, location?.body ?? raw)
}

export function removeFrontmatterValue(raw: string, key: string): string {
	const location = locateFrontmatter(raw)
	if (!location) return raw
	const document = parseYamlDocument(location.yaml)
	document.delete(key)
	if (
		document.contents === null ||
		(isMap(document.contents) && document.contents.items.length === 0)
	) {
		return location.body
	}
	return serializeDocument(document, location, location.body)
}

export function parseYamlMapping(yaml: string): PropertyMap {
	const document = parseYamlDocument(yaml)
	const value = document.toJS({ mapAsMap: false })
	return value && typeof value === "object" && !Array.isArray(value) ? (value as PropertyMap) : {}
}
