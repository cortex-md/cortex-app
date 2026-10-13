import { useState } from "react"
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native"

import type { TextPromptDialogProps } from "@/components/ui/dialogTypes"
import { MobileTextField } from "@/components/ui/MobileTextField"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function TextPromptDialog({
	cancelLabel = "Cancel",
	confirmLabel,
	error,
	initialValue = "",
	message,
	onCancel,
	onChangeText,
	onConfirm,
	placeholder,
	title,
	visible,
}: TextPromptDialogProps) {
	const { colors } = useMobileColors()
	const [value, setValue] = useState(initialValue)
	const confirmEnabled = value.trim().length > 0 && !error

	function submit() {
		if (confirmEnabled) onConfirm(value.trim())
	}

	return (
		<Modal
			animationType="fade"
			onRequestClose={onCancel}
			statusBarTranslucent
			transparent
			visible={visible}
		>
			<KeyboardAvoidingView behavior="padding" style={styles.flex}>
				<Pressable onPress={onCancel} style={[styles.scrim, { backgroundColor: colors.scrim }]}>
					<Pressable
						onPress={(event) => event.stopPropagation()}
						style={[
							IS_IOS ? styles.alert : styles.dialog,
							{ backgroundColor: IS_IOS ? colors.elevated : colors.fill },
						]}
					>
						<Text style={[IS_IOS ? styles.alertTitle : styles.dialogTitle, { color: colors.label }]}>
							{title}
						</Text>
						{message ? (
							<Text style={[IS_IOS ? styles.alertMessage : styles.dialogMessage, { color: colors.secondaryLabel }]}>
								{message}
							</Text>
						) : null}
						<MobileTextField
							autoFocus
							error={error}
							onChangeText={(next) => {
								setValue(next)
								onChangeText?.(next)
							}}
							onSubmitText={submit}
							placeholder={placeholder}
							returnKeyType="done"
							value={value}
						/>
						{IS_IOS ? (
							<View style={styles.alertActions}>
								<Pressable onPress={onCancel} style={({ pressed }) => [styles.alertButton, { opacity: pressed ? 0.6 : 1 }]}>
									<Text style={[styles.alertButtonLabel, { color: colors.tint }]}>{cancelLabel}</Text>
								</Pressable>
								<Pressable
									disabled={!confirmEnabled}
									onPress={submit}
									style={({ pressed }) => [
										styles.alertButton,
										{ backgroundColor: colors.tintFill, opacity: !confirmEnabled ? 0.4 : pressed ? 0.8 : 1 },
									]}
								>
									<Text style={[styles.alertButtonLabel, { color: colors.onTint }]}>{confirmLabel}</Text>
								</Pressable>
							</View>
						) : (
							<View style={styles.dialogActions}>
								<Pressable android_ripple={{ color: colors.hover }} onPress={onCancel} style={styles.textButton}>
									<Text style={[styles.textButtonLabel, { color: colors.tint }]}>{cancelLabel}</Text>
								</Pressable>
								<Pressable
									android_ripple={{ color: colors.hover }}
									disabled={!confirmEnabled}
									onPress={submit}
									style={[styles.textButton, !confirmEnabled ? styles.disabled : null]}
								>
									<Text style={[styles.textButtonLabel, { color: colors.tint }]}>{confirmLabel}</Text>
								</Pressable>
							</View>
						)}
					</Pressable>
				</Pressable>
			</KeyboardAvoidingView>
		</Modal>
	)
}

const styles = StyleSheet.create({
	alert: {
		borderCurve: "continuous",
		borderRadius: 28,
		gap: 12,
		padding: 20,
		width: 300,
	},
	alertActions: {
		flexDirection: "row",
		gap: 8,
		marginTop: 4,
	},
	alertButton: {
		alignItems: "center",
		borderRadius: 999,
		flex: 1,
		height: 44,
		justifyContent: "center",
	},
	alertButtonLabel: {
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
	},
	alertMessage: {
		fontSize: 13,
		lineHeight: 18,
		textAlign: "center",
	},
	alertTitle: {
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
		textAlign: "center",
	},
	dialog: {
		borderCurve: "continuous",
		borderRadius: 28,
		gap: 16,
		marginHorizontal: 28,
		maxWidth: 560,
		padding: 24,
		width: "100%",
	},
	dialogActions: {
		flexDirection: "row",
		gap: 8,
		justifyContent: "flex-end",
	},
	dialogMessage: {
		fontSize: 14,
		letterSpacing: 0.25,
		lineHeight: 20,
	},
	dialogTitle: {
		fontSize: 24,
		lineHeight: 32,
	},
	disabled: {
		opacity: 0.4,
	},
	flex: {
		flex: 1,
	},
	scrim: {
		alignItems: "center",
		flex: 1,
		justifyContent: "center",
		padding: 16,
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
})
