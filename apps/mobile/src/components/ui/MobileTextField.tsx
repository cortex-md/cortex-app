import { type ComponentPropsWithoutRef, type Ref, useRef } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

type ReactNativeTextInputProps = ComponentPropsWithoutRef<typeof TextInput>

interface MobileTextFieldProps
	extends Omit<ReactNativeTextInputProps, "onSubmitEditing" | "style"> {
	error?: string | null
	label?: string
	onSubmitText?: (value: string) => void
	ref?: Ref<TextInput>
	style?: ReactNativeTextInputProps["style"]
}

export function MobileTextField({
	defaultValue,
	error,
	label,
	onChangeText,
	onSubmitText,
	placeholderTextColor,
	ref,
	style,
	value,
	...props
}: MobileTextFieldProps) {
	const { colors } = useMobileColors()
	const valueRef = useRef(value ?? defaultValue ?? "")

	return (
		<View style={styles.root}>
			{label ? <Text style={[styles.label, { color: colors.secondaryLabel }]}>{label}</Text> : null}
			<TextInput
				{...props}
				ref={ref}
				defaultValue={defaultValue}
				onChangeText={(nextValue) => {
					valueRef.current = nextValue
					onChangeText?.(nextValue)
				}}
				onSubmitEditing={() => {
					onSubmitText?.(valueRef.current)
				}}
				placeholderTextColor={placeholderTextColor ?? colors.secondaryLabel}
				style={[
					styles.input,
					{
						backgroundColor: colors.secondaryBackground,
						borderColor: error ? colors.destructive : colors.separator,
						color: colors.label,
					},
					style,
				]}
				value={value}
			/>
			{error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
		</View>
	)
}

const styles = StyleSheet.create({
	error: {
		fontSize: 12,
		letterSpacing: 0,
		lineHeight: 16,
	},
	input: {
		borderRadius: 8,
		borderWidth: StyleSheet.hairlineWidth,
		fontSize: 16,
		letterSpacing: 0,
		lineHeight: 21,
		minHeight: 46,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	label: {
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 0,
		lineHeight: 16,
		textTransform: "uppercase",
	},
	root: {
		gap: 6,
	},
})
