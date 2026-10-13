import { Host } from "@expo/ui"
import {
	DropdownMenu,
	DropdownMenuItem,
	HorizontalDivider,
	RNHostView,
	Text,
} from "@expo/ui/jetpack-compose"
import { Check } from "lucide-react-native"
import { Fragment, useState } from "react"
import { Pressable, StyleSheet, Text as RNText, View } from "react-native"

import type { NativeMenuProps } from "@/components/ui/menuTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function NativeMenu({ accessibilityLabel, groups, header, icon, title }: NativeMenuProps) {
	const { colors } = useMobileColors()
	const [expanded, setExpanded] = useState(false)
	const AnchorIcon = icon?.Lucide

	return (
		<Host matchContents>
			<DropdownMenu
				color={colors.fill}
				expanded={expanded}
				onDismissRequest={() => setExpanded(false)}
			>
				<DropdownMenu.Trigger>
					<RNHostView matchContents>
						<Pressable
							accessibilityLabel={accessibilityLabel}
							android_ripple={{ borderless: true, color: colors.hover }}
							onPress={() => setExpanded(true)}
							style={styles.anchor}
						>
							{AnchorIcon ? (
								<AnchorIcon color={colors.secondaryLabel} size={24} strokeWidth={2} />
							) : (
								<RNText style={[styles.anchorText, { color: colors.tint }]}>{title}</RNText>
							)}
						</Pressable>
					</RNHostView>
				</DropdownMenu.Trigger>
				<DropdownMenu.Items>
					{header ? (
						<DropdownMenuItem enabled={false}>
							<DropdownMenuItem.Text>
								<Text color={colors.secondaryLabel} style={{ typography: "labelMedium" }}>
									{header}
								</Text>
							</DropdownMenuItem.Text>
						</DropdownMenuItem>
					) : null}
					{groups.map((group, groupIndex) => (
						<Fragment key={groupIndex}>
							{groupIndex > 0 ? <HorizontalDivider color={colors.separator} /> : null}
							{group.map((item) => {
								const ItemIcon = item.icon?.Lucide
								const itemColor = item.destructive ? colors.destructiveText : colors.label
								return (
									<DropdownMenuItem
										elementColors={{ textColor: itemColor, leadingIconColor: itemColor }}
										enabled={!item.disabled}
										key={item.key}
										onClick={() => {
											setExpanded(false)
											item.onPress()
										}}
									>
										<DropdownMenuItem.Text>
											<Text color={itemColor} style={{ typography: "bodyMedium" }}>
												{item.label}
											</Text>
										</DropdownMenuItem.Text>
										{ItemIcon || item.checked ? (
											<DropdownMenuItem.LeadingIcon>
												<RNHostView matchContents>
													<View>
														{item.checked ? (
															<Check color={colors.tint} size={20} strokeWidth={2.4} />
														) : ItemIcon ? (
															<ItemIcon color={colors.secondaryLabel} size={20} strokeWidth={2} />
														) : null}
													</View>
												</RNHostView>
											</DropdownMenuItem.LeadingIcon>
										) : null}
									</DropdownMenuItem>
								)
							})}
						</Fragment>
					))}
				</DropdownMenu.Items>
			</DropdownMenu>
		</Host>
	)
}

const styles = StyleSheet.create({
	anchor: {
		alignItems: "center",
		height: 48,
		justifyContent: "center",
		minWidth: 48,
		paddingHorizontal: 8,
	},
	anchorText: {
		fontSize: 14,
		fontWeight: "500",
		letterSpacing: 0.1,
		lineHeight: 20,
	},
})
