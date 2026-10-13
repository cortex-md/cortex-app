import { Host } from "@expo/ui"
import {
	DropdownMenu,
	DropdownMenuItem,
	FloatingActionButton,
	HorizontalDivider,
	RNHostView,
	Text,
} from "@expo/ui/jetpack-compose"
import { Fragment, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { SymbolIcon } from "@/components/ui/Symbol"
import { NOTE_BOTTOM_MENU_ICON } from "@/features/note/noteMenu"
import type { NoteBottomMenuProps } from "@/features/note/noteChromeTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function NoteBottomMenu({ groups }: NoteBottomMenuProps) {
	const { colors, scheme } = useMobileColors()
	const insets = useSafeAreaInsets()
	const [expanded, setExpanded] = useState(false)
	return (
		<View style={[styles.row, { paddingBottom: Math.max(insets.bottom, 16) }]}>
			<Host colorScheme={scheme} matchContents seedColor={colors.tintFill}>
				<DropdownMenu
					color={colors.fill}
					expanded={expanded}
					onDismissRequest={() => setExpanded(false)}
				>
					<DropdownMenu.Trigger>
						<FloatingActionButton
							containerColor={colors.accentSubtle}
							onClick={() => setExpanded(true)}
						>
							<FloatingActionButton.Icon>
								<RNHostView matchContents>
									<SymbolIcon color={colors.tint} name={NOTE_BOTTOM_MENU_ICON} size={24} />
								</RNHostView>
							</FloatingActionButton.Icon>
						</FloatingActionButton>
					</DropdownMenu.Trigger>
					<DropdownMenu.Items>
						{groups.map((group, groupIndex) => (
							<Fragment key={group[0]?.key ?? groupIndex}>
								{groupIndex > 0 ? <HorizontalDivider color={colors.separator} /> : null}
								{group.map((item) => (
									<DropdownMenuItem
										elementColors={{ textColor: colors.label }}
										enabled={!item.disabled}
										key={item.key}
										onClick={() => {
											setExpanded(false)
											item.onPress()
										}}
									>
										<DropdownMenuItem.Text>
											<Text color={colors.label} style={{ typography: "bodyLarge" }}>
												{item.label}
											</Text>
										</DropdownMenuItem.Text>
										{item.icon ? (
											<DropdownMenuItem.LeadingIcon>
												<RNHostView matchContents>
													<View>
														<SymbolIcon color={colors.secondaryLabel} name={item.icon} size={22} />
													</View>
												</RNHostView>
											</DropdownMenuItem.LeadingIcon>
										) : null}
									</DropdownMenuItem>
								))}
							</Fragment>
						))}
					</DropdownMenu.Items>
				</DropdownMenu>
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
