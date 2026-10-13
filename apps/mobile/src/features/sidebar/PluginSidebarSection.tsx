import { usePluginStore } from "@cortex/plugin-host-core"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { openPluginView } from "@/features/plugins/openPluginView"
import { PluginIcon } from "@/features/plugins/PluginIcon"
import { SidebarSectionHeader } from "@/features/sidebar/SidebarRows"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function PluginSidebarSection({ closeSidebar }: { closeSidebar: () => void }) {
	const sidebarItems = usePluginStore((state) => state.sidebarItems)
	const { colors } = useMobileColors()
	if (sidebarItems.length === 0) return null

	return (
		<View>
			<SidebarSectionHeader label="Plugins" />
			{sidebarItems.map((item) => (
				<Pressable
					accessibilityRole="button"
					android_ripple={{ color: colors.hover }}
					key={item.key}
					onPress={() => {
						closeSidebar()
						openPluginView(item.viewKey)
					}}
					style={({ pressed }) => [
						styles.row,
						{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
					]}
				>
					<PluginIcon
						color={IS_IOS ? colors.tint : colors.secondaryLabel}
						name={item.icon}
						size={IS_IOS ? 20 : 24}
						strokeWidth={2}
					/>
					<Text numberOfLines={1} style={[styles.rowText, { color: colors.label }]}>
						{item.label}
					</Text>
				</Pressable>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	row: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 10 : 999,
		flexDirection: "row",
		gap: 12,
		minHeight: IS_IOS ? 44 : 56,
		overflow: "hidden",
		paddingHorizontal: IS_IOS ? 12 : 16,
	},
	rowText: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 14,
		fontWeight: IS_IOS ? "400" : "500",
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: IS_IOS ? 22 : 20,
		minWidth: 0,
	},
})
