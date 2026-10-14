import { useSyncStore } from "@cortex/core"
import { toVaultRelativePath } from "@cortex/platform/utils"
import { Pressable, StyleSheet, Text } from "react-native"

import { SymbolIcon } from "@/components/ui/Symbol"
import { openConflict } from "@/features/navigation/routes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function NoteConflictBanner({
	filePath,
	vaultPath,
}: {
	filePath: string | null
	vaultPath: string | undefined
}) {
	const { colors } = useMobileColors()
	const relativePath = filePath && vaultPath ? toVaultRelativePath(filePath, vaultPath) : null
	const conflicted = useSyncStore((state) =>
		relativePath ? Boolean(state.conflicts[relativePath]) : false,
	)
	if (!conflicted || !filePath) return null

	return (
		<Pressable
			accessibilityRole="button"
			onPress={() => openConflict(filePath)}
			style={[styles.banner, { backgroundColor: colors.warningBackground }]}
		>
			<SymbolIcon
				color={colors.warningText}
				name={{ sf: "exclamationmark.triangle.fill", md: "warning" }}
				size={18}
			/>
			<Text style={[styles.label, { color: colors.warningText }]}>
				This note changed on another device. Review the conflict.
			</Text>
			<SymbolIcon
				color={colors.warningText}
				name={{ sf: "chevron.right", md: "chevron_right" }}
				size={13}
			/>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	banner: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 12,
		flexDirection: "row",
		gap: 10,
		marginHorizontal: 16,
		marginVertical: 6,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	label: {
		flex: 1,
		fontSize: 14,
		lineHeight: 19,
	},
})
