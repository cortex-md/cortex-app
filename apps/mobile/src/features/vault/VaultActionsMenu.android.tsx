import {
	DropdownMenu,
	DropdownMenuItem,
	HorizontalDivider,
	ListItem,
	RNHostView,
	Text,
} from "@expo/ui/jetpack-compose"
import { clickable } from "@expo/ui/jetpack-compose/modifiers"
import { Fragment, useState } from "react"
import { StyleSheet, View } from "react-native"

import { SymbolIcon } from "@/components/ui/Symbol"
import type { VaultActionsMenuProps } from "@/features/vault/vaultActionsTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function VaultActionsMenu({ color, groups, subtitle, title, value }: VaultActionsMenuProps) {
	const { colors } = useMobileColors()
	const [expanded, setExpanded] = useState(false)
	const supporting = [subtitle, value].filter(Boolean).join(" · ")
	return (
		<DropdownMenu
			color={colors.elevated}
			expanded={expanded}
			onDismissRequest={() => setExpanded(false)}
		>
			<DropdownMenu.Trigger>
				<ListItem
					colors={{
						containerColor: colors.cell,
						contentColor: colors.label,
						supportingContentColor: colors.secondaryLabel,
						trailingContentColor: colors.secondaryLabel,
					}}
					modifiers={[clickable(() => setExpanded(true))]}
				>
					<ListItem.HeadlineContent>
						<Text>{title}</Text>
					</ListItem.HeadlineContent>
					{supporting ? (
						<ListItem.SupportingContent>
							<Text>{supporting}</Text>
						</ListItem.SupportingContent>
					) : null}
					<ListItem.LeadingContent>
						<RNHostView matchContents>
							<View style={[styles.dot, { backgroundColor: color }]} />
						</RNHostView>
					</ListItem.LeadingContent>
					<ListItem.TrailingContent>
						<RNHostView matchContents>
							<SymbolIcon
								color={colors.secondaryLabel}
								name={{ md: "more_vert", sf: "ellipsis" }}
								size={24}
							/>
						</RNHostView>
					</ListItem.TrailingContent>
				</ListItem>
			</DropdownMenu.Trigger>
			<DropdownMenu.Items>
				{groups.map((group, groupIndex) => (
					<Fragment key={groupIndex}>
						{groupIndex > 0 ? <HorizontalDivider color={colors.separator} /> : null}
						{group.map((item) => {
							const itemColor = item.destructive ? colors.destructiveText : colors.label
							return (
								<DropdownMenuItem
									elementColors={{ leadingIconColor: itemColor, textColor: itemColor }}
									enabled={!item.disabled}
									key={item.key}
									onClick={() => {
										setExpanded(false)
										item.onPress()
									}}
								>
									<DropdownMenuItem.Text>
										<Text color={String(itemColor)} style={{ typography: "bodyLarge" }}>
											{item.label}
										</Text>
									</DropdownMenuItem.Text>
									{item.icon ? (
										<DropdownMenuItem.LeadingIcon>
											<RNHostView matchContents>
												<SymbolIcon color={itemColor} name={item.icon} size={24} />
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
	)
}

const styles = StyleSheet.create({
	dot: {
		borderRadius: 999,
		height: 12,
		width: 12,
	},
})
