import { BottomSheet, Column, Host, ListItem, Text } from "@expo/ui"
import { EllipsisVertical } from "lucide-react-native"
import { Fragment } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import type { VaultActionsMenuProps } from "@/features/vault/vaultActionsTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function VaultActionsMenu({
	accessibilityLabel,
	groups,
	message,
	onPresentedChange,
	presented,
	title,
}: VaultActionsMenuProps) {
	const { colors } = useMobileColors()
	return (
		<>
			<Pressable
				accessibilityLabel={accessibilityLabel}
				accessibilityRole="button"
				android_ripple={{ borderless: true, color: colors.hover }}
				onPress={() => onPresentedChange(true)}
				style={styles.anchor}
			>
				<EllipsisVertical color={colors.secondaryLabel} size={24} strokeWidth={2} />
			</Pressable>
			<View style={styles.sheetHost}>
				<Host>
					<BottomSheet
						containerColor={colors.elevated}
						isPresented={presented}
						onDismiss={() => onPresentedChange(false)}
						showDragIndicator
					>
						<Column spacing={4}>
							<ListItem
								colors={{
									containerColor: colors.elevated,
									contentColor: colors.label,
									supportingContentColor: colors.secondaryLabel,
								}}
								supportingText={message}
							>
								<Text textStyle={{ color: colors.label, fontWeight: "600" }}>{title}</Text>
							</ListItem>
							{groups.map((group, groupIndex) => (
								<Fragment key={groupIndex}>
									{group.map((item) => {
										const ItemIcon = item.icon?.Lucide
										const color = item.destructive ? colors.destructiveText : colors.label
										return (
											<ListItem
												colors={{ containerColor: colors.elevated, contentColor: color }}
												key={item.key}
												leading={
													ItemIcon ? <ItemIcon color={color} size={24} strokeWidth={2} /> : undefined
												}
												onPress={
													item.disabled
														? undefined
														: () => {
																onPresentedChange(false)
																item.onPress()
															}
												}
											>
												<Text textStyle={{ color }}>{item.label}</Text>
											</ListItem>
										)
									})}
								</Fragment>
							))}
						</Column>
					</BottomSheet>
				</Host>
			</View>
		</>
	)
}

const styles = StyleSheet.create({
	anchor: {
		alignItems: "center",
		height: 48,
		justifyContent: "center",
		width: 48,
	},
	sheetHost: {
		height: 0,
		width: 0,
	},
})
