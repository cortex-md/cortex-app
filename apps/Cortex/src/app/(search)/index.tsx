import { ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native"

import { getMobileColorScheme, mobileColors } from "@/theme/colors"

export default function SearchScreen() {
	const scheme = getMobileColorScheme(useColorScheme())
	const colors = mobileColors[scheme]

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
			style={{ backgroundColor: colors.background }}
		>
			<View style={styles.emptyState}>
				<Text style={[styles.title, { color: colors.label }]}>Nothing to search</Text>
				<Text style={[styles.subtitle, { color: colors.secondaryLabel }]}>
					Open a vault to build the local index.
				</Text>
			</View>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	content: {
		padding: 20,
	},
	emptyState: {
		gap: 8,
	},
	subtitle: {
		fontSize: 16,
		lineHeight: 22,
	},
	title: {
		fontSize: 24,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 30,
	},
})
