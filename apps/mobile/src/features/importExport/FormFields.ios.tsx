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
	foregroundStyle,
	lineLimit,
	multilineTextAlignment,
	pickerStyle,
	progressViewStyle,
	shapes,
	tag,
	textInputAutocapitalization,
	tint,
} from "@expo/ui/swift-ui/modifiers"

import type {
	FormChoiceRowProps,
	FormPickerProps,
	FormProgressProps,
	FormTextFieldProps,
	FormTextProps,
} from "@/features/importExport/formFieldTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

const SECONDARY = foregroundStyle({ style: "secondary", type: "hierarchical" })

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
			<VStack alignment="leading" spacing={6}>
				<Text modifiers={[font({ textStyle: "footnote" }), SECONDARY]}>{label}</Text>
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
		<HStack spacing={12}>
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
	return (
		<Picker
			label={label}
			modifiers={[pickerStyle(segmented ? "segmented" : "menu")]}
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
	return (
		<Button modifiers={[buttonStyle("plain"), disabledModifier(disabled)]} onPress={onPress}>
			<HStack modifiers={[contentShape(shapes.rectangle())]} spacing={12}>
				{icon ? <Image color={colors.tint} systemName={icon.sf} /> : null}
				<VStack alignment="leading" spacing={2}>
					<Text modifiers={[foregroundStyle(colors.label)]}>{title}</Text>
					{subtitle ? (
						<Text modifiers={[font({ textStyle: "footnote" }), SECONDARY]}>{subtitle}</Text>
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
	const { colors } = useMobileColors()
	return (
		<VStack alignment="leading" spacing={8}>
			<ProgressView
				modifiers={[progressViewStyle("linear"), tint(colors.tintFill)]}
				value={value}
			/>
			<Text modifiers={[font({ textStyle: "footnote" }), SECONDARY]}>{label}</Text>
		</VStack>
	)
}

export function FormText({ monospace = false, secondary = false, text }: FormTextProps) {
	const modifiers = [
		...(monospace ? [font({ design: "monospaced", textStyle: "footnote" })] : []),
		...(secondary ? [SECONDARY] : []),
	]
	return <Text modifiers={modifiers}>{text}</Text>
}
