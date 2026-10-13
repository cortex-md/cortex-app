import { Host } from "@expo/ui"
import {
	Button,
	Divider,
	GlassEffectContainer,
	HStack,
	Image,
	Menu,
	Spacer,
} from "@expo/ui/swift-ui"
import {
	accessibilityLabel,
	buttonBorderShape,
	buttonStyle,
	controlSize,
	font,
	foregroundStyle,
	frame,
	glassEffect,
	padding,
} from "@expo/ui/swift-ui/modifiers"
import { Fragment } from "react"
import { StyleSheet } from "react-native"

import { HIDE_KEYBOARD_ICON, MORE_ICON } from "@/features/note/keyboardToolbarItems"
import type { KeyboardToolbarProps } from "@/features/note/noteChromeTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

const BUTTON_SIZE = 38

export function KeyboardToolbar({ actions, more, onHideKeyboard }: KeyboardToolbarProps) {
	const { colors, scheme } = useMobileColors()
	const iconModifiers = [
		font({ size: 17, weight: "medium" }),
		foregroundStyle(colors.label),
		frame({ height: BUTTON_SIZE, width: BUTTON_SIZE }),
	]
	const glass = glassEffect({ glass: { variant: "regular" }, shape: "capsule" })

	return (
		<Host colorScheme={scheme} matchContents={{ vertical: true }} style={styles.host}>
			<GlassEffectContainer spacing={8}>
				<HStack spacing={8}>
					<HStack modifiers={[padding({ horizontal: 4, vertical: 3 }), glass]} spacing={0}>
						{actions.map((action) => (
							<Button
								key={action.key}
								modifiers={[buttonStyle("plain"), accessibilityLabel(action.label)]}
								onPress={action.onPress}
							>
								<Image modifiers={iconModifiers} systemName={action.icon.sf} />
							</Button>
						))}
						<Menu
							label={<Image modifiers={iconModifiers} systemName={MORE_ICON.sf} />}
							modifiers={[buttonStyle("plain"), accessibilityLabel("More formatting")]}
						>
							{more.map((group, groupIndex) => (
								<Fragment key={group[0]?.key ?? groupIndex}>
									{groupIndex > 0 ? <Divider /> : null}
									{group.map((item) => (
										<Button
											key={item.key}
											label={item.label}
											onPress={item.onPress}
											systemImage={item.icon?.sf}
										/>
									))}
								</Fragment>
							))}
						</Menu>
					</HStack>
					<Spacer />
					<Button
						modifiers={[
							buttonStyle("glass"),
							buttonBorderShape("circle"),
							controlSize("large"),
							foregroundStyle(colors.label),
							accessibilityLabel("Hide keyboard"),
						]}
						onPress={onHideKeyboard}
					>
						<Image systemName={HIDE_KEYBOARD_ICON.sf} />
					</Button>
				</HStack>
			</GlassEffectContainer>
		</Host>
	)
}

const styles = StyleSheet.create({
	host: {
		marginBottom: 8,
		marginHorizontal: 12,
		marginTop: 6,
	},
})
