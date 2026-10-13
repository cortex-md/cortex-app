import { Platform, StyleSheet, Text, TextInput, View } from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import { MobileTextField } from "@/components/ui/MobileTextField"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function TemplateField({
	code = false,
	label,
	onChangeText,
	placeholder,
	value,
}: {
	code?: boolean
	label: string
	onChangeText: (value: string) => void
	placeholder?: string
	value: string
}) {
	const { colors } = useMobileColors()

	if (!IS_IOS) {
		return (
			<MobileTextField
				autoCapitalize="none"
				autoCorrect={false}
				label={label}
				onChangeText={onChangeText}
				placeholder={placeholder}
				style={code ? styles.code : undefined}
				value={value}
			/>
		)
	}

	return (
		<View style={styles.row}>
			<Text style={[styles.label, { color: colors.secondaryLabel }]}>{label}</Text>
			<TextInput
				accessibilityLabel={label}
				autoCapitalize="none"
				autoCorrect={false}
				onChangeText={onChangeText}
				placeholder={placeholder}
				placeholderTextColor={colors.placeholder}
				style={[styles.input, { color: colors.label }, code ? styles.code : null]}
				value={value}
			/>
		</View>
	)
}

export function TemplateGroupHeader({ team, title }: { team?: string | null; title: string }) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.groupHeader}>
			{team ? <Avatar name={team} size={18} /> : null}
			<Text style={[styles.groupTitle, { color: IS_IOS ? colors.secondaryLabel : colors.tint }]}>
				{title}
			</Text>
		</View>
	)
}

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
	code: {
		fontFamily: Platform.select({ android: "monospace", default: "Menlo" }),
		fontSize: 14,
	},
	groupHeader: {
		alignItems: "center",
		flexDirection: "row",
		gap: 6,
		marginBottom: 8,
		marginHorizontal: IS_IOS ? 36 : 32,
		marginTop: 20,
	},
	groupTitle: {
		fontSize: IS_IOS ? 13 : 14,
		fontWeight: IS_IOS ? "400" : "500",
		lineHeight: IS_IOS ? 18 : 20,
	},
	input: {
		flex: 1,
		fontSize: 17,
		lineHeight: 22,
		minWidth: 0,
		padding: 0,
	},
	label: {
		fontSize: 17,
		lineHeight: 22,
		width: 88,
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
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		minHeight: 52,
		paddingHorizontal: 16,
	},
	value: {
		fontSize: 15,
		lineHeight: 20,
	},
})
