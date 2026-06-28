export type MarkdownUrlKind = "link" | "image"

const linkProtocols = new Set(["http:", "https:", "mailto:"])
const imageProtocols = new Set(["http:", "https:", "asset:", "cortex:", "blob:"])
const imageDataPattern = /^data:image\/(?:avif|gif|jpeg|png|webp);(?:base64,|charset=[^,]+,)/i

function extractProtocol(value: string): string | null {
	const match = value.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)
	return match ? `${match[1].toLowerCase()}:` : null
}

function removeControlCharacters(value: string): string {
	return Array.from(value)
		.filter((character) => character.charCodeAt(0) > 32)
		.join("")
}

export function sanitizeMarkdownUrl(value: string, kind: MarkdownUrlKind): string | null {
	const trimmed = value.trim()
	if (!trimmed) return null
	const normalizedForProtocol = removeControlCharacters(trimmed)
	if (kind === "link" && normalizedForProtocol.startsWith("#")) return trimmed
	if (
		normalizedForProtocol.startsWith("./") ||
		normalizedForProtocol.startsWith("../") ||
		normalizedForProtocol.startsWith("/")
	) {
		return normalizedForProtocol.startsWith("//") ? null : trimmed
	}

	const protocol = extractProtocol(normalizedForProtocol)
	if (!protocol) return trimmed
	if (kind === "link") return linkProtocols.has(protocol) ? trimmed : null
	if (protocol === "data:") return imageDataPattern.test(normalizedForProtocol) ? trimmed : null
	return imageProtocols.has(protocol) ? trimmed : null
}
