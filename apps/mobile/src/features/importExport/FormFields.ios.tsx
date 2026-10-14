import {
	Button,
	HStack,
	Image,
	Picker,
	ProgressView,
	Spacer,
	Text,
	TextField,
	useNativeState,
	VStack,
} from "@expo/ui/swift-ui"
import {
	autocorrectionDisabled,
	buttonStyle,
	contentShape,
	disabled as disabledModifier,
	font,
	lineLimit,
	multilineTextAlignment,
	pickerStyle,
	progressViewStyle,
	shapes,
	tag,
	textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers"

import { useFormTheme } from "@/components/ui/formTheme"
import type {
	FormChoiceRowProps,
	FormPickerProps,
	FormProgressProps,
	FormTextFieldProps,
	FormTextProps,
} from "@/features/importExport/formFieldTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

export function FormTextField({
	disabled = false,
	initialValue,
	label,
	monospace = false,
	multiline = false,
	onChangeText,
	placeholder,
}: FormTextFieldProps) {
	const text = useNativeState(initialValue)
	const theme = useFormTheme()
	const modifiers = [
		disabledModifier(disabled),
		...(monospace
			? [
					font({ design: "monospaced" }),
					autocorrectionDisabled(),
					textInputAutocapitalization("never"),
				]
			: []),
	]
	if (multiline) {
		return (
			<VStack alignment="leading" modifiers={theme.row} spacing={6}>
				<Text modifiers={[font({ textStyle: "footnote" }), theme.secondary]}>{label}</Text>
				<TextField
					axis="vertical"
					modifiers={[...modifiers, lineLimit({ max: 6, min: 2 })]}
					onTextChange={onChangeText}
					placeholder={placeholder ?? label}
					text={text}
				/>
			</VStack>
		)
	}
	return (
		<HStack modifiers={theme.row} spacing={12}>
			<Text>{label}</Text>
			<TextField
				modifiers={[...modifiers, multilineTextAlignment("trailing")]}
				onTextChange={onChangeText}
				placeholder={placeholder ?? label}
				text={text}
			/>
		</HStack>
	)
}

export function FormPicker<T extends string>({
	label,
	onChange,
	options,
	segmented = false,
	value,
}: FormPickerProps<T>) {
	const theme = useFormTheme()
	return (
		<Picker
			label={label}
			modifiers={[pickerStyle(segmented ? "segmented" : "menu"), ...theme.row]}
			onSelectionChange={(selection) => onChange(selection as T)}
			selection={value}
		>
			{options.map((option) => (
				<Text key={option.value} modifiers={[tag(option.value)]}>
					{option.label}
				</Text>
			))}
		</Picker>
	)
}

export function FormChoiceRow({
	disabled = false,
	icon,
	onPress,
	selected,
	subtitle,
	title,
}: FormChoiceRowProps) {
	const { colors } = useMobileColors()
	const theme = useFormTheme()
	return (
		<Button
			modifiers={[buttonStyle("plain"), disabledModifier(disabled), ...theme.row]}
			onPress={onPress}
		>
			<HStack modifiers={[contentShape(shapes.rectangle())]} spacing={12}>
				{icon ? <Image color={colors.tint} systemName={icon.sf} /> : null}
				<VStack alignment="leading" spacing={2}>
					<Text modifiers={[disabled ? theme.secondary : theme.label]}>{title}</Text>
					{subtitle ? (
						<Text modifiers={[font({ textStyle: "footnote" }), theme.secondary]}>{subtitle}</Text>
					) : null}
				</VStack>
				<Spacer />
				{selected ? (
					<Image
						color={colors.tint}
						modifiers={[font({ size: 15, weight: "semibold" })]}
						systemName="checkmark"
					/>
				) : null}
			</HStack>
		</Button>
	)
}

export function FormProgress({ label, value }: FormProgressProps) {
	const theme = useFormTheme()
	return (
		<VStack alignment="leading" modifiers={theme.row} spacing={8}>
			<ProgressView modifiers={[progressViewStyle("linear"), theme.toggle]} value={value} />
			<Text modifiers={[font({ textStyle: "footnote" }), theme.secondary]}>{label}</Text>
		</VStack>
	)
}

export function FormText({ monospace = false, secondary = false, text }: FormTextProps) {
	const theme = useFormTheme()
	const modifiers = [
		...(monospace ? [font({ design: "monospaced", textStyle: "footnote" })] : []),
		secondary ? theme.secondary : theme.label,
		...theme.row,
	]
	return <Text modifiers={modifiers}>{text}</Text>
}
