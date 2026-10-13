import { Platform, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

export function TaskLineCode({ line }: { line: string }) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.block, { backgroundColor: colors.codeBackground }]}>
			<Text selectable style={[styles.text, { color: colors.label }]}>
				{line}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	block: {
		borderCurve: "continuous",
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	text: {
		fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
		fontSize: 13,
		lineHeight: 18,
	},
})
