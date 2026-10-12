import { ChevronDown, FolderOpen } from "lucide-react-native"
import { Pressable, StyleSheet, Text } from "react-native"

import type { MobileColors, MobileIconColors } from "@/theme/colors"

export function WorkspaceSwitcher({
	colors,
	iconColors,
	onPress,
	vaultName,
}: {
	colors: MobileColors
	iconColors: MobileIconColors
	onPress: () => void
	vaultName: string
}) {
	return (
		<Pressable
			accessibilityLabel="Switch vault"
			onPress={onPress}
			style={({ pressed }) => [
				styles.workspaceSwitcher,
				{
					backgroundColor: colors.secondaryBackground,
					opacity: pressed ? 0.68 : 1,
				},
			]}
		>
			<FolderOpen color={iconColors.secondary} size={18} strokeWidth={2.2} />
			<Text numberOfLines={1} style={[styles.workspaceName, { color: colors.label }]}>
				{vaultName}
			</Text>
			<ChevronDown color={iconColors.secondary} size={15} strokeWidth={2.2} />
		</Pressable>
	)
}

const styles = StyleSheet.create({
	workspaceName: {
		flex: 1,
		fontSize: 16,
		fontWeight: "600",
		letterSpacing: 0,
		lineHeight: 21,
		minWidth: 0,
	},
	workspaceSwitcher: {
		alignItems: "center",
		borderRadius: 8,
		flex: 1,
		flexDirection: "row",
		gap: 8,
		minHeight: 42,
		paddingHorizontal: 12,
	},
})
