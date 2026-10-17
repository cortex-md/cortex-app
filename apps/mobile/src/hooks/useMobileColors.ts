import { useMemo } from "react"

import { useActiveTheme } from "@/hooks/useActiveTheme"
import { createIconColors, createMobileColors, type MobileColors } from "@/theme/colors"

export function useMobileColors() {
	const theme = useActiveTheme()
	return useMemo(() => {
		const colors: MobileColors = createMobileColors(theme)
		return {
			colors,
			iconColors: createIconColors(colors),
			scheme: colors.scheme,
			staticColors: colors,
			themeName: theme.name,
		}
	}, [theme])
}
