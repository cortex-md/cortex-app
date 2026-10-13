import { Host } from "@expo/ui"
import { Button, Divider, Image, Menu, Section, Text } from "@expo/ui/swift-ui"
import { buttonStyle, foregroundStyle, frame, glassEffect } from "@expo/ui/swift-ui/modifiers"
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
	const anchorModifiers =
		anchorStyle === "glass"
			? [frame({ height: 44, minWidth: 44 }), glassEffect({ shape: "capsule" }), foregroundStyle(colors.label)]
			: [foregroundStyle(colors.tint)]

	return (
		<Host matchContents>
			<Menu
				label={
					icon ? (
						<Image modifiers={anchorModifiers} systemName={icon.sf} />
					) : (
						<Text modifiers={anchorModifiers}>{title ?? accessibilityLabel}</Text>
					)
				}
				modifiers={[buttonStyle("plain")]}
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
