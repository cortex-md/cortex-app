import { Menu } from "lucide-react-native"
import { Pressable, StyleSheet } from "react-native"

import { useMobileSidebar } from "@/features/sidebar/useMobileSidebar"
import { useMobileColors } from "@/hooks/useMobileColors"

export function SidebarToggleButton({ color }: { color?: string }) {
	const { iconColors } = useMobileColors()
	const { openSidebar } = useMobileSidebar()

	return (
		<Pressable
			accessibilityLabel="Open sidebar"
			hitSlop={8}
			onPress={openSidebar}
			style={({ pressed }) => [styles.headerIconButton, { opacity: pressed ? 0.52 : 1 }]}
		>
			<Menu color={color ?? iconColors.tint} size={22} strokeWidth={2.25} />
		</Pressable>
	)
}

const styles = StyleSheet.create({
	headerIconButton: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: 32,
		minWidth: 32,
	},
})
