import { Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useTabBarHidden } from "@/features/navigation/tabBarVisibility"

const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 64 : 80
const BOTTOM_CHROME_HEIGHT = 104
const GAP = 12

export function useToastBottomOffset(): number {
	const insets = useSafeAreaInsets()
	const tabBarHidden = useTabBarHidden()
	return insets.bottom + (tabBarHidden ? BOTTOM_CHROME_HEIGHT : TAB_BAR_HEIGHT) + GAP
}
