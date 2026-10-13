import { Pressable, StyleSheet } from "react-native"

import { Symbol } from "@/components/ui/Symbol"
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
			<Symbol
				color={color ?? iconColors.tint}
				name={{ sf: "sidebar.leading", md: "menu" }}
				size={24}
			/>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	headerIconButton: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: 44,
		minWidth: 44,
	},
})
