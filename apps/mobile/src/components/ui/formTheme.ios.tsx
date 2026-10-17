import {
	foregroundStyle,
	listRowBackground,
	listRowSeparatorTint,
	tint,
} from "@expo/ui/swift-ui/modifiers"
import { useMemo } from "react"

import type { FormTheme } from "@/components/ui/formTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function useFormTheme(): FormTheme {
	const { colors } = useMobileColors()
	return useMemo(
		() => ({
			accent: foregroundStyle(colors.tint),
			label: foregroundStyle(colors.label),
			row: [listRowBackground(colors.cell), listRowSeparatorTint(colors.separator)],
			secondary: foregroundStyle(colors.secondaryLabel),
			tertiary: foregroundStyle(colors.tertiaryLabel),
			toggle: tint(colors.tintFill),
		}),
		[colors],
	)
}
