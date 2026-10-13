import { Pressable, StyleSheet, View } from "react-native"

import { NativeMenu } from "@/components/ui/NativeMenu"
import { SymbolIcon, type SymbolName } from "@/components/ui/Symbol"
import { HIDE_KEYBOARD_ICON, MORE_ICON } from "@/features/note/keyboardToolbarItems"
import type { KeyboardToolbarProps } from "@/features/note/noteChromeTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

function ToolbarButton({
	icon,
	label,
	onPress,
}: {
	icon: SymbolName
	label: string
	onPress: () => void
}) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			accessibilityLabel={label}
			accessibilityRole="button"
			android_ripple={{ borderless: true, color: colors.hover }}
			onPress={onPress}
			style={styles.button}
		>
			<SymbolIcon color={colors.label} name={icon} size={22} />
		</Pressable>
	)
}

export function KeyboardToolbar({ actions, more, onHideKeyboard }: KeyboardToolbarProps) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.row}>
			<View style={[styles.surface, { backgroundColor: colors.secondaryBackground }]}>
				{actions.map((action) => (
					<ToolbarButton
						icon={action.icon}
						key={action.key}
						label={action.label}
						onPress={action.onPress}
					/>
				))}
				<NativeMenu accessibilityLabel="More formatting" groups={more} icon={MORE_ICON} />
			</View>
			<View style={[styles.hide, { backgroundColor: colors.accentSubtle }]}>
				<ToolbarButton icon={HIDE_KEYBOARD_ICON} label="Hide keyboard" onPress={onHideKeyboard} />
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	button: {
		alignItems: "center",
		height: 44,
		justifyContent: "center",
		width: 40,
	},
	hide: {
		borderRadius: 16,
		elevation: 3,
		overflow: "hidden",
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		justifyContent: "space-between",
		marginBottom: 8,
		marginHorizontal: 12,
		marginTop: 6,
	},
	surface: {
		alignItems: "center",
		borderRadius: 28,
		elevation: 3,
		flexDirection: "row",
		paddingHorizontal: 4,
	},
})
