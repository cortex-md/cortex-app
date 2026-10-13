import { Bell, BellRing } from "lucide-react-native"
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const PLATFORM_NAME = IS_IOS ? "iOS" : "Android"
const PROMPT_TITLE = "Get reminded on time"
const PROMPT_BODY = `Cortex only notifies you for tasks with ⏰, the daily digest and, if you want, when someone mentions you. ${PLATFORM_NAME} asks you next.`

export function NotificationPermissionPrompt({
	onContinue,
	onDismiss,
	visible,
}: {
	onContinue: () => void
	onDismiss: () => void
	visible: boolean
}) {
	const { colors } = useMobileColors()

	if (!IS_IOS) {
		return (
			<Modal
				animationType="fade"
				onRequestClose={onDismiss}
				statusBarTranslucent
				transparent
				visible={visible}
			>
				<Pressable onPress={onDismiss} style={[styles.scrim, { backgroundColor: colors.scrim }]}>
					<Pressable
						accessibilityLabel={PROMPT_TITLE}
						accessibilityRole="alert"
						onPress={(event) => event.stopPropagation()}
						style={[styles.dialog, { backgroundColor: colors.fill }]}
					>
						<BellRing color={colors.tint} size={24} strokeWidth={2} />
						<Text style={[styles.dialogTitle, { color: colors.label }]}>{PROMPT_TITLE}</Text>
						<Text style={[styles.dialogBody, { color: colors.secondaryLabel }]}>{PROMPT_BODY}</Text>
						<View style={styles.dialogActions}>
							<Pressable
								android_ripple={{ color: colors.hover }}
								onPress={onDismiss}
								style={styles.textButton}
							>
								<Text style={[styles.textButtonLabel, { color: colors.tint }]}>Not now</Text>
							</Pressable>
							<Pressable
								android_ripple={{ color: colors.hover }}
								onPress={onContinue}
								style={styles.textButton}
							>
								<Text style={[styles.textButtonLabel, { color: colors.tint }]}>Continue</Text>
							</Pressable>
						</View>
					</Pressable>
				</Pressable>
			</Modal>
		)
	}

	return (
		<Modal
			animationType="slide"
			onRequestClose={onDismiss}
			statusBarTranslucent
			transparent
			visible={visible}
		>
			<Pressable onPress={onDismiss} style={[styles.sheetScrim, { backgroundColor: colors.scrim }]}>
				<Pressable
					accessibilityLabel="Allow reminders"
					accessibilityRole="none"
					onPress={(event) => event.stopPropagation()}
					style={[styles.sheet, { backgroundColor: colors.groupedBackground }]}
				>
					<View style={[styles.grabber, { backgroundColor: colors.tertiaryLabel }]} />
					<View style={[styles.iconBox, { backgroundColor: colors.accentSubtle }]}>
						<Bell color={colors.tint} size={28} strokeWidth={2} />
					</View>
					<Text style={[styles.sheetTitle, { color: colors.label }]}>{PROMPT_TITLE}</Text>
					<Text style={[styles.sheetBody, { color: colors.secondaryLabel }]}>{PROMPT_BODY}</Text>
					<View style={styles.sheetActions}>
						<Pressable
							onPress={onContinue}
							style={({ pressed }) => [
								styles.fillButton,
								{ backgroundColor: colors.tintFill, opacity: pressed ? 0.8 : 1 },
							]}
						>
							<Text style={[styles.fillButtonLabel, { color: colors.onTint }]}>Continue</Text>
						</Pressable>
						<Pressable
							onPress={onDismiss}
							style={({ pressed }) => [styles.plainButton, { opacity: pressed ? 0.6 : 1 }]}
						>
							<Text style={[styles.fillButtonLabel, { color: colors.tint }]}>Not now</Text>
						</Pressable>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	)
}

const styles = StyleSheet.create({
	dialog: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 28,
		gap: 16,
		marginHorizontal: 28,
		maxWidth: 560,
		padding: 24,
		width: "100%",
	},
	dialogActions: {
		alignSelf: "stretch",
		flexDirection: "row",
		gap: 8,
		justifyContent: "flex-end",
	},
	dialogBody: {
		fontSize: 14,
		letterSpacing: 0.25,
		lineHeight: 20,
		textAlign: "center",
	},
	dialogTitle: {
		fontSize: 24,
		lineHeight: 32,
		textAlign: "center",
	},
	fillButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 50,
		justifyContent: "center",
	},
	fillButtonLabel: {
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
	},
	grabber: {
		borderRadius: 999,
		height: 5,
		marginBottom: 26,
		opacity: 0.5,
		width: 36,
	},
	iconBox: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 20,
		height: 64,
		justifyContent: "center",
		width: 64,
	},
	plainButton: {
		alignItems: "center",
		height: 50,
		justifyContent: "center",
	},
	scrim: {
		alignItems: "center",
		flex: 1,
		justifyContent: "center",
		padding: 16,
	},
	sheet: {
		alignItems: "center",
		borderCurve: "continuous",
		borderTopLeftRadius: 40,
		borderTopRightRadius: 40,
		paddingBottom: 34,
		paddingHorizontal: 24,
		paddingTop: 10,
	},
	sheetActions: {
		alignSelf: "stretch",
		gap: 8,
		marginTop: 24,
	},
	sheetBody: {
		fontSize: 15,
		lineHeight: 20,
		maxWidth: 310,
		textAlign: "center",
	},
	sheetScrim: {
		flex: 1,
		justifyContent: "flex-end",
	},
	sheetTitle: {
		fontSize: 22,
		fontWeight: "700",
		lineHeight: 28,
		marginBottom: 8,
		marginTop: 18,
		textAlign: "center",
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
