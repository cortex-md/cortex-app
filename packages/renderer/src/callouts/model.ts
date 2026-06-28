export interface ParsedCallout {
	type: string
	title: string
	fold: "expanded" | "collapsed" | null
	bodyMarkdown: string
}

export interface ParsedCalloutMarker {
	type: string
	title: string
	fold: "expanded" | "collapsed" | null
	markerLength: number
}

export function normalizeCalloutName(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
}

export function formatCalloutLabel(type: string): string {
	return type
		.split(/[-_]/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ")
}

export function parseCalloutMarker(source: string): ParsedCalloutMarker | null {
	const markerMatch = source.match(/^(\s*>\s*\[!([a-zA-Z0-9_-]+)\]([+-])?(?:[ \t]+)?)(.*?)\s*$/)
	if (!markerMatch) return null

	return {
		type: normalizeCalloutName(markerMatch[2]),
		title: markerMatch[4]?.trim() ?? "",
		fold: markerMatch[3] === "+" ? "expanded" : markerMatch[3] === "-" ? "collapsed" : null,
		markerLength: markerMatch[1].length,
	}
}

export function parseCallout(source: string): ParsedCallout | null {
	const lines = source.split(/\r?\n/)
	const marker = parseCalloutMarker(lines[0] ?? "")
	if (!marker) return null

	const bodyMarkdown = lines
		.slice(1)
		.map((line) => line.replace(/^\s*>\s?/, ""))
		.join("\n")
		.replace(/\s+$/, "")

	return {
		type: marker.type,
		title: marker.title,
		fold: marker.fold,
		bodyMarkdown,
	}
}
