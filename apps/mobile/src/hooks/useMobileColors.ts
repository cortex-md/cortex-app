import { useColorScheme } from "react-native"

import {
	getMobileColorScheme,
	mobileColors,
	mobileIconColors,
	mobileStaticColors,
} from "@/theme/colors"

export function useMobileColors() {
	const scheme = getMobileColorScheme(useColorScheme())
	return {
		colors: mobileColors[scheme],
		iconColors: mobileIconColors[scheme],
		scheme,
		staticColors: mobileStaticColors[scheme],
	}
}
