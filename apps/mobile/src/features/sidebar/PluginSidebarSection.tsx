import { usePluginStore } from "@cortex/plugin-host-core"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { openPluginView } from "@/features/plugins/openPluginView"
import { PluginIcon } from "@/features/plugins/PluginIcon"
import { useMobileColors } from "@/hooks/useMobileColors"

export function PluginSidebarSection({ closeSidebar }: { closeSidebar: () => void }) {
	const sidebarItems = usePluginStore((state) => state.sidebarItems)
	const { colors, iconColors } = useMobileColors()
	if (sidebarItems.length === 0) return null

	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: colors.secondaryLabel }]}>Plugins</Text>
			{sidebarItems.map((item) => (
				<Pressable
					accessibilityRole="button"
					key={item.key}
					onPress={() => {
						closeSidebar()
						openPluginView(item.viewKey)
					}}
					style={({ pressed }) => [styles.row, { opacity: pressed ? 0.58 : 1 }]}
				>
					<PluginIcon color={iconColors.secondary} name={item.icon} size={18} strokeWidth={2.15} />
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
		borderRadius: 8,
		flexDirection: "row",
		gap: 8,
		minHeight: 36,
		paddingHorizontal: 10,
	},
	rowText: {
		flex: 1,
		fontSize: 15,
		fontWeight: "500",
		letterSpacing: 0,
		lineHeight: 20,
		minWidth: 0,
	},
	section: {
		gap: 2,
		paddingTop: 16,
	},
	sectionTitle: {
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 16,
		paddingHorizontal: 10,
		paddingBottom: 4,
		textTransform: "uppercase",
	},
})
