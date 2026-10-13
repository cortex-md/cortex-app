import { StyleSheet, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

export function ImportProgressBar({ value }: { value: number }) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.track, { backgroundColor: colors.fill }]}>
			<View
				style={[
					styles.fill,
					{ backgroundColor: colors.tintFill, width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` },
				]}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	fill: {
		borderRadius: 999,
		height: 6,
	},
	track: {
		borderRadius: 999,
		height: 6,
		overflow: "hidden",
	},
})
