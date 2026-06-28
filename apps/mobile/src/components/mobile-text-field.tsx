import {
	forwardRef,
	useRef,
	type ComponentPropsWithoutRef,
	type ForwardedRef,
} from "react"
import {
	StyleSheet,
	Text,
	TextInput,
	type TextInput as ReactNativeTextInput,
	useColorScheme,
	View,
} from "react-native"

import { getMobileColorScheme, mobileColors } from "@/theme/colors"

type ReactNativeTextInputProps = ComponentPropsWithoutRef<typeof TextInput>

interface MobileTextFieldProps
	extends Omit<ReactNativeTextInputProps, "onSubmitEditing" | "style"> {
	error?: string | null
	label?: string
	onSubmitText?: (value: string) => void
	style?: ReactNativeTextInputProps["style"]
}

function MobileTextFieldBase(
	{
		defaultValue,
		error,
		label,
		onChangeText,
		onSubmitText,
		placeholderTextColor,
		style,
		value,
		...props
	}: MobileTextFieldProps,
	ref: ForwardedRef<ReactNativeTextInput>,
) {
	const scheme = getMobileColorScheme(useColorScheme())
	const colors = mobileColors[scheme]
	const valueRef = useRef(value ?? defaultValue ?? "")

	return (
		<View style={styles.root}>
			{label ? (
				<Text style={[styles.label, { color: colors.secondaryLabel }]}>{label}</Text>
			) : null}
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

export const MobileTextField = forwardRef(MobileTextFieldBase)

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
