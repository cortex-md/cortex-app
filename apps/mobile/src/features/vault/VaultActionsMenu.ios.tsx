import { Button, Divider, HStack, Image, Menu, Spacer, Text, VStack } from "@expo/ui/swift-ui"
import {
	buttonStyle,
	contentShape,
	font,
	foregroundStyle,
	shapes,
} from "@expo/ui/swift-ui/modifiers"
import { Fragment } from "react"

import type { VaultActionsMenuProps } from "@/features/vault/vaultActionsTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function VaultActionsMenu({
	accessibilityLabel,
	color,
	groups,
	subtitle,
	title,
	value,
}: VaultActionsMenuProps) {
	const { colors } = useMobileColors()
	return (
		<Menu
			label={
				<HStack modifiers={[contentShape(shapes.rectangle())]} spacing={12}>
					<Image color={color} size={12} systemName="circle.fill" />
					<VStack alignment="leading" spacing={2}>
						<Text modifiers={[foregroundStyle(colors.label)]}>{title}</Text>
						{subtitle ? (
							<Text
								modifiers={[
									font({ textStyle: "footnote" }),
									foregroundStyle({ type: "hierarchical", style: "secondary" }),
								]}
							>
								{subtitle}
							</Text>
						) : null}
					</VStack>
					<Spacer />
					{value ? (
						<Text modifiers={[foregroundStyle({ type: "hierarchical", style: "secondary" })]}>
							{value}
						</Text>
					) : null}
					<Image
						modifiers={[
							font({ size: 13, weight: "semibold" }),
							foregroundStyle({ type: "hierarchical", style: "tertiary" }),
						]}
						systemName="ellipsis"
					/>
				</HStack>
			}
			modifiers={[buttonStyle("plain")]}
			testID={accessibilityLabel}
		>
			{groups.map((group, groupIndex) => (
				<Fragment key={groupIndex}>
					{groupIndex > 0 ? <Divider /> : null}
					{group.map((item) => (
						<Button
							key={item.key}
							label={item.label}
							onPress={item.disabled ? undefined : item.onPress}
							role={item.destructive ? "destructive" : "default"}
							systemImage={item.checked ? "checkmark" : item.icon?.sf}
						/>
					))}
				</Fragment>
			))}
		</Menu>
	)
}
