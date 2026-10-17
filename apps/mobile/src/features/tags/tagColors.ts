import type { MobileColors } from "@/theme/colors"

export interface TagColorOption {
	key: string
	label: string
	value: string
}

export function getTagColorOptions(colors: MobileColors): TagColorOption[] {
	return [
		{ key: "red", label: "Red", value: colors.swatchRed },
		{ key: "yellow", label: "Yellow", value: colors.swatchYellow },
		{ key: "green", label: "Green", value: colors.swatchGreen },
		{ key: "blue", label: "Blue", value: colors.headingBlue },
		{ key: "violet", label: "Violet", value: colors.headingViolet },
		{ key: "accent", label: "Accent", value: colors.tintFill },
	]
}

export function resolveTagColor(color: string | null | undefined, colors: MobileColors): string {
	return color ?? colors.tertiaryLabel
}
