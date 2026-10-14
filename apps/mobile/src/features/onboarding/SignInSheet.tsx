import { Modal, Platform, StyleSheet, View } from "react-native"

import { SignInForm } from "@/features/account/SignInScreen"
import { useMobileColors } from "@/hooks/useMobileColors"

export function SignInSheet({ onClose, visible }: { onClose: () => void; visible: boolean }) {
	const { colors } = useMobileColors()
	return (
		<Modal
			animationType="slide"
			onRequestClose={onClose}
			presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
			visible={visible}
		>
			<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
				{visible ? <SignInForm initialMode="sign-in" onCancel={onClose} onDone={onClose} /> : null}
			</View>
		</Modal>
	)
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
})
