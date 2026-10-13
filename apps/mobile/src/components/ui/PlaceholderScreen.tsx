import { ScrollView, StyleSheet, Text } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

export function PlaceholderScreen({ title }: { title: string }) {
	const { colors } = useMobileColors()
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			contentInsetAdjustmentBehavior="automatic"
			style={{ backgroundColor: colors.groupedBackground }}
		>
			<Text style={[styles.text, { color: colors.secondaryLabel }]}>{title}</Text>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	content: {
		padding: 24,
	},
	text: {
		fontSize: 15,
		lineHeight: 20,
	},
})
