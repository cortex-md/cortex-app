import { Host } from "@expo/ui"
import { Button, Divider, Image, Menu, Section, Text } from "@expo/ui/swift-ui"
import {
	buttonBorderShape,
	buttonStyle,
	controlSize,
	foregroundStyle,
	padding,
} from "@expo/ui/swift-ui/modifiers"
import { Fragment } from "react"

import type { NativeMenuProps } from "@/components/ui/menuTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function NativeMenu({
	accessibilityLabel,
	anchorStyle = "glass",
	groups,
	header,
	icon,
	title,
}: NativeMenuProps) {
	const { colors } = useMobileColors()
	const glass = anchorStyle === "glass"
	const menuModifiers = glass
		? [
				buttonStyle("glass"),
				buttonBorderShape(icon ? "circle" : "capsule"),
				controlSize("large"),
				foregroundStyle(colors.label),
				padding({ all: 4 }),
			]
		: [buttonStyle("borderless"), foregroundStyle(colors.tint)]

	return (
		<Host matchContents>
			<Menu
				label={icon ? <Image systemName={icon.sf} /> : <Text>{title ?? accessibilityLabel}</Text>}
				modifiers={menuModifiers}
				testID={accessibilityLabel}
			>
				{header ? <Section title={header}>{null}</Section> : null}
				{groups.map((group, groupIndex) => (
					<Fragment key={groupIndex}>
						{groupIndex > 0 ? <Divider /> : null}
						{group.map((item) => (
							<Button
								key={item.key}
								label={item.label}
								modifiers={item.disabled ? [foregroundStyle(colors.disabled)] : undefined}
								onPress={item.disabled ? undefined : item.onPress}
								role={item.destructive ? "destructive" : "default"}
								systemImage={item.checked ? "checkmark" : item.icon?.sf}
							/>
						))}
					</Fragment>
				))}
			</Menu>
		</Host>
	)
}
