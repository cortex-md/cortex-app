import { Modal, Pressable, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

export interface RadioDialogOption<T extends string> {
	label: string
	value: T
}

export interface RadioDialogAction {
	label: string
	onPress: () => void
}

export function RadioDialog<T extends string>({
	actions,
	message,
	onDone,
	onSelect,
	options,
	title,
	value,
	visible,
}: {
	actions?: RadioDialogAction[]
	message?: string
	onDone: () => void
	onSelect: (value: T) => void
	options: RadioDialogOption<T>[]
	title: string
	value: T
	visible: boolean
}) {
	const { colors } = useMobileColors()

	return (
		<Modal
			animationType="fade"
			onRequestClose={onDone}
			statusBarTranslucent
			transparent
			visible={visible}
		>
			<Pressable onPress={onDone} style={[styles.scrim, { backgroundColor: colors.scrim }]}>
				<Pressable
					accessibilityLabel={title}
					accessibilityRole="none"
					onPress={(event) => event.stopPropagation()}
					style={[styles.dialog, { backgroundColor: colors.fill }]}
				>
					<Text style={[styles.title, { color: colors.label }]}>{title}</Text>
					<View accessibilityRole="radiogroup">
						{options.map((option) => {
							const selected = option.value === value
							return (
								<Pressable
									accessibilityRole="radio"
									accessibilityState={{ selected }}
									android_ripple={{ color: colors.hover }}
									key={option.value}
									onPress={() => onSelect(option.value)}
									style={styles.row}
								>
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
									<Text style={[styles.rowLabel, { color: colors.label }]}>{option.label}</Text>
								</Pressable>
							)
						})}
					</View>
					{message ? (
						<Text style={[styles.message, { color: colors.secondaryLabel }]}>{message}</Text>
					) : null}
					<View style={styles.actions}>
						{actions?.map((action) => (
							<Pressable
								android_ripple={{ color: colors.hover }}
								key={action.label}
								onPress={action.onPress}
								style={styles.textButton}
							>
								<Text style={[styles.textButtonLabel, { color: colors.tint }]}>{action.label}</Text>
							</Pressable>
						))}
						<Pressable
							android_ripple={{ color: colors.hover }}
							onPress={onDone}
							style={styles.textButton}
						>
							<Text style={[styles.textButtonLabel, { color: colors.tint }]}>Done</Text>
						</Pressable>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	)
}

const styles = StyleSheet.create({
	actions: {
		flexDirection: "row",
		gap: 8,
		justifyContent: "flex-end",
		paddingHorizontal: 16,
		paddingTop: 12,
	},
	dialog: {
		borderCurve: "continuous",
		borderRadius: 28,
		marginHorizontal: 28,
		maxWidth: 560,
		paddingBottom: 12,
		paddingTop: 24,
		width: "100%",
	},
	message: {
		fontSize: 14,
		letterSpacing: 0.25,
		lineHeight: 20,
		paddingHorizontal: 24,
		paddingTop: 12,
	},
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
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: 16,
		minHeight: 48,
		paddingHorizontal: 24,
	},
	rowLabel: {
		flex: 1,
		fontSize: 16,
		letterSpacing: 0.5,
		lineHeight: 24,
	},
	textButton: {
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	textButtonLabel: {
		fontSize: 14,
		fontWeight: "500",
		letterSpacing: 0.1,
		lineHeight: 20,
	},
	title: {
		fontSize: 24,
		lineHeight: 32,
		marginBottom: 12,
		paddingHorizontal: 24,
	},
	scrim: {
		alignItems: "center",
		flex: 1,
		justifyContent: "center",
		padding: 16,
	},
})
