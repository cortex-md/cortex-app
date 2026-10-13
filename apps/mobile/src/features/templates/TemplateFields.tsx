import { StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

export function PlaceholderValue({ placeholder, value }: { placeholder: boolean; value: string }) {
	const { colors } = useMobileColors()
	if (!value) {
		return <Text style={[styles.value, { color: colors.tertiaryLabel }]}>Empty</Text>
	}
	if (!placeholder) {
		return (
			<Text numberOfLines={1} style={[styles.value, { color: colors.label }]}>
				{value}
			</Text>
		)
	}
	return (
		<View style={[styles.placeholder, { borderColor: colors.headingBlue }]}>
			<Text numberOfLines={1} style={[styles.placeholderText, { color: colors.headingBlue }]}>
				{value}
			</Text>
		</View>
	)
}

export function PropertiesBox({
	properties,
}: {
	properties: { key: string; value: string; placeholder: boolean }[]
}) {
	const { colors } = useMobileColors()
	if (properties.length === 0) return null
	return (
		<View style={[styles.box, { borderColor: colors.separator }]}>
			{properties.map((property, index) => (
				<View
					key={property.key}
					style={[
						styles.propertyRow,
						index > 0
							? { borderTopColor: colors.separator, borderTopWidth: StyleSheet.hairlineWidth }
							: null,
					]}
				>
					<Text numberOfLines={1} style={[styles.propertyKey, { color: colors.secondaryLabel }]}>
						{property.key}
					</Text>
					<View style={styles.propertyValue}>
						<PlaceholderValue placeholder={property.placeholder} value={property.value} />
					</View>
				</View>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	box: {
		borderCurve: "continuous",
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	placeholder: {
		alignSelf: "flex-start",
		borderRadius: 6,
		borderStyle: "dashed",
		borderWidth: 1,
		paddingHorizontal: 6,
		paddingVertical: 1,
	},
	placeholderText: {
		fontSize: 15,
		lineHeight: 20,
	},
	propertyKey: {
		fontSize: 14,
		fontWeight: "500",
		lineHeight: 18,
		width: 112,
	},
	propertyRow: {
		alignItems: "center",
		flexDirection: "row",
		minHeight: 44,
		paddingHorizontal: 4,
	},
	propertyValue: {
		flex: 1,
		minWidth: 0,
	},
	value: {
		fontSize: 15,
		lineHeight: 20,
	},
})
