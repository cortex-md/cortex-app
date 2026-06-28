interface RgbColor {
	red: number
	green: number
	blue: number
}

function parseHexColor(hex: string): RgbColor {
	const normalized = hex.trim().replace(/^#/, "")
	const expanded =
		normalized.length === 3
			? normalized
					.split("")
					.map((value) => `${value}${value}`)
					.join("")
			: normalized

	if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
		throw new Error(`Unsupported color format: ${hex}`)
	}

	return {
		red: Number.parseInt(expanded.slice(0, 2), 16),
		green: Number.parseInt(expanded.slice(2, 4), 16),
		blue: Number.parseInt(expanded.slice(4, 6), 16),
	}
}

function formatHexColor(color: RgbColor): string {
	return `#${[color.red, color.green, color.blue]
		.map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
		.join("")}`
}

function mixColors(color: RgbColor, target: RgbColor, amount: number): RgbColor {
	return {
		red: color.red + (target.red - color.red) * amount,
		green: color.green + (target.green - color.green) * amount,
		blue: color.blue + (target.blue - color.blue) * amount,
	}
}

function getRelativeLuminance(hex: string): number {
	const { red, green, blue } = parseHexColor(hex)
	const channels = [red, green, blue].map((channel) => {
		const value = channel / 255
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
	})
	return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

export function getContrastRatio(foreground: string, background: string): number {
	const foregroundLuminance = getRelativeLuminance(foreground)
	const backgroundLuminance = getRelativeLuminance(background)
	const lighter = Math.max(foregroundLuminance, backgroundLuminance)
	const darker = Math.min(foregroundLuminance, backgroundLuminance)
	return (lighter + 0.05) / (darker + 0.05)
}

export function resolveAccessibleForeground(
	background: string,
	darkForeground = "#0a0a09",
	lightForeground = "#ffffff",
): string {
	return getContrastRatio(darkForeground, background) >=
		getContrastRatio(lightForeground, background)
		? darkForeground
		: lightForeground
}

export function resolveAccessibleColor(
	color: string,
	background: string,
	minimumContrast = 3,
): string {
	if (getContrastRatio(color, background) >= minimumContrast) return color

	const source = parseHexColor(color)
	const dark = parseHexColor("#0a0a09")
	const light = parseHexColor("#ffffff")
	const target =
		getContrastRatio("#0a0a09", background) >= getContrastRatio("#ffffff", background)
			? dark
			: light

	for (let amount = 0.05; amount <= 1; amount += 0.05) {
		const candidate = formatHexColor(mixColors(source, target, amount))
		if (getContrastRatio(candidate, background) >= minimumContrast) return candidate
	}

	return formatHexColor(target)
}
