const HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/
const RGB_COLOR = /^rgba?\(([^()]*)\)$/

const KEYWORD_COLORS: Record<string, string> = {
	black: "#000000",
	transparent: "#00000000",
	white: "#ffffff",
}

function toHexByte(value: number): string {
	return Math.round(Math.min(255, Math.max(0, value)))
		.toString(16)
		.padStart(2, "0")
}

function parseChannel(value: string): number | null {
	const number = Number.parseFloat(value)
	if (!Number.isFinite(number)) return null
	return value.endsWith("%") ? (number / 100) * 255 : number
}

function parseAlpha(value: string): number | null {
	const number = Number.parseFloat(value)
	if (!Number.isFinite(number)) return null
	return value.endsWith("%") ? number / 100 : number
}

function rgbToHex(body: string): string | null {
	const parts = body
		.replace("/", " ")
		.split(/[\s,]+/)
		.filter(Boolean)
	if (parts.length !== 3 && parts.length !== 4) return null
	const channels = parts.slice(0, 3).map(parseChannel)
	const alpha = parts[3] === undefined ? 1 : parseAlpha(parts[3])
	if (alpha === null || channels.some((channel) => channel === null)) return null
	const hex = `#${channels.map((channel) => toHexByte(channel ?? 0)).join("")}`
	return alpha >= 1 ? hex : `${hex}${toHexByte(alpha * 255)}`
}

export function normalizeColor(value: string): string | null {
	const color = value.trim().toLowerCase()
	const keyword = KEYWORD_COLORS[color]
	if (keyword) return keyword
	const hex = HEX_COLOR.exec(color)?.[1]
	if (hex) {
		const expanded = hex.length <= 4 ? [...hex].map((char) => char + char).join("") : hex
		return expanded.endsWith("ff") && expanded.length === 8
			? `#${expanded.slice(0, 6)}`
			: `#${expanded}`
	}
	const rgb = RGB_COLOR.exec(color)?.[1]
	return rgb === undefined ? null : rgbToHex(rgb)
}
