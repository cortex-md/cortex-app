import { Host } from "@expo/ui"
import {
	DropdownMenu,
	DropdownMenuItem,
	HorizontalDivider,
	RNHostView,
	Text,
} from "@expo/ui/jetpack-compose"
import { Fragment, useState } from "react"
import { Pressable, StyleSheet, Text as RNText, View } from "react-native"

import type { NativeMenuProps } from "@/components/ui/menuTypes"
import { SymbolIcon } from "@/components/ui/Symbol"
import { useMobileColors } from "@/hooks/useMobileColors"

export function NativeMenu({ accessibilityLabel, groups, header, icon, title }: NativeMenuProps) {
	const { colors } = useMobileColors()
	const [expanded, setExpanded] = useState(false)

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
							{icon ? (
								<SymbolIcon color={colors.secondaryLabel} name={icon} size={24} />
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
										{item.icon || item.checked ? (
											<DropdownMenuItem.LeadingIcon>
												<RNHostView matchContents>
													<View>
														{item.checked ? (
															<SymbolIcon
																color={colors.tint}
																name={{ sf: "checkmark", md: "check" }}
																size={20}
															/>
														) : item.icon ? (
															<SymbolIcon
																color={colors.secondaryLabel}
																name={item.icon}
																size={20}
															/>
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
