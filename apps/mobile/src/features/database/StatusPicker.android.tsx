import { BottomSheet, Column, Host, ListItem, Text } from "@expo/ui"
import { StyleSheet, View } from "react-native"

import { StatusPill } from "@/components/ui/StatusPill"
import type { StatusPickerProps } from "@/features/database/statusPickerTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function StatusPicker({
	message,
	onPresentedChange,
	onSelect,
	options,
	presented,
	title,
	value,
}: StatusPickerProps) {
	const { colors } = useMobileColors()
	const itemColors = {
		containerColor: colors.elevated,
		contentColor: colors.label,
		supportingContentColor: colors.secondaryLabel,
	}

	return (
		<View style={styles.sheetHost}>
			<Host>
				<BottomSheet
					containerColor={colors.elevated}
					isPresented={presented}
					onDismiss={() => onPresentedChange(false)}
					showDragIndicator
				>
					<Column spacing={2}>
						<ListItem colors={itemColors} supportingText={message}>
							<Text textStyle={{ color: colors.label, fontSize: 22 }}>{title}</Text>
						</ListItem>
						{options.map((option) => {
							const selected = option.id === value
							return (
								<ListItem
									colors={itemColors}
									key={option.id}
									leading={
										<View
											style={[
												styles.radio,
												{ borderColor: selected ? colors.tintFill : colors.secondaryLabel },
											]}
										>
											{selected ? (
												<View style={[styles.radioDot, { backgroundColor: colors.tintFill }]} />
											) : null}
										</View>
									}
									onPress={() => {
										onPresentedChange(false)
										onSelect(option.id)
									}}
									trailing={<StatusPill label={option.label} tone={option.tone} />}
								>
									<Text textStyle={{ color: colors.label }}>{option.label}</Text>
								</ListItem>
							)
						})}
					</Column>
				</BottomSheet>
			</Host>
		</View>
	)
}

const styles = StyleSheet.create({
	radio: {
		alignItems: "center",
		borderRadius: 999,
		borderWidth: 2,
		height: 20,
		justifyContent: "center",
		width: 20,
	},
	radioDot: {
		borderRadius: 999,
		height: 10,
		width: 10,
	},
	sheetHost: {
		height: 0,
		width: 0,
	},
})
