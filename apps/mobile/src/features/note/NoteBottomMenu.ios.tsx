import { Host } from "@expo/ui"
import { Button, Divider, Image, Menu } from "@expo/ui/swift-ui"
import {
	accessibilityLabel,
	buttonStyle,
	font,
	foregroundStyle,
	frame,
	glassEffect,
} from "@expo/ui/swift-ui/modifiers"
import { Fragment } from "react"
import { StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { NOTE_BOTTOM_MENU_ICON, NOTE_BOTTOM_MENU_LABEL } from "@/features/note/noteMenu"
import type { NoteBottomMenuProps } from "@/features/note/noteChromeTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function NoteBottomMenu({ groups }: NoteBottomMenuProps) {
	const { colors, scheme } = useMobileColors()
	const insets = useSafeAreaInsets()
	return (
		<View style={[styles.row, { paddingBottom: Math.max(insets.bottom, 12) }]}>
			<Host colorScheme={scheme} matchContents>
				<Menu
					label={
						<Image
							modifiers={[
								font({ size: 20, weight: "medium" }),
								foregroundStyle(colors.label),
								frame({ height: 52, width: 52 }),
								glassEffect({ glass: { interactive: true, variant: "regular" }, shape: "circle" }),
							]}
							systemName={NOTE_BOTTOM_MENU_ICON.sf}
						/>
					}
					modifiers={[buttonStyle("plain"), accessibilityLabel(NOTE_BOTTOM_MENU_LABEL)]}
				>
					{groups.map((group, groupIndex) => (
						<Fragment key={group[0]?.key ?? groupIndex}>
							{groupIndex > 0 ? <Divider /> : null}
							{group.map((item) => (
								<Button
									key={item.key}
									label={item.label}
									onPress={item.disabled ? undefined : item.onPress}
									systemImage={item.icon?.sf}
								/>
							))}
						</Fragment>
					))}
				</Menu>
			</Host>
		</View>
	)
}

const styles = StyleSheet.create({
	row: {
		alignItems: "flex-end",
		paddingHorizontal: 16,
		paddingTop: 8,
	},
})
