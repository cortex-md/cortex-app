import { Search, X } from "lucide-react-native"
import { type ComponentProps, useRef } from "react"
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

type SearchFieldProps = Omit<ComponentProps<typeof TextInput>, "style"> & {
	onClear?: () => void
}

export function SearchField({ onClear, value, ...props }: SearchFieldProps) {
	const { colors } = useMobileColors()
	const inputRef = useRef<TextInput>(null)

	return (
		<View style={[styles.field, { backgroundColor: colors.fill }]}>
			<Search color={colors.secondaryLabel} size={IS_IOS ? 18 : 24} strokeWidth={2.2} />
			<TextInput
				{...props}
				autoCapitalize="none"
				autoCorrect={false}
				placeholderTextColor={colors.secondaryLabel}
				ref={inputRef}
				returnKeyType="search"
				style={[styles.input, { color: colors.label }]}
				value={value}
			/>
			{value ? (
				<Pressable
					accessibilityLabel="Clear"
					hitSlop={8}
					onPress={() => {
						onClear?.()
						inputRef.current?.focus()
					}}
				>
					<X color={colors.secondaryLabel} size={18} strokeWidth={2.4} />
				</Pressable>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	field: {
		alignItems: "center",
		borderRadius: 999,
		flexDirection: "row",
		gap: IS_IOS ? 8 : 12,
		height: IS_IOS ? 44 : 56,
		marginHorizontal: 16,
		paddingHorizontal: IS_IOS ? 14 : 16,
	},
	input: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 16,
		letterSpacing: IS_IOS ? 0 : 0.5,
		lineHeight: IS_IOS ? 22 : 24,
		minWidth: 0,
		padding: 0,
	},
})
