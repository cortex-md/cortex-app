import {
	HStack,
	Picker,
	Slider,
	Spacer,
	Text,
	TextField,
	useNativeState,
	VStack,
} from "@expo/ui/swift-ui"
import {
	autocorrectionDisabled,
	disabled as disabledModifier,
	font,
	keyboardType,
	labelsHidden,
	pickerStyle,
	submitLabel,
	tag,
	textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers"
import { useRef } from "react"

import { useFormTheme } from "@/components/ui/formTheme"
import type {
	SettingsOptionValue,
	SettingsPickerProps,
	SettingsSliderProps,
	SettingsTextFieldProps,
} from "@/features/settings/settingsControlTypes"

export function SettingsPicker<T extends SettingsOptionValue>({
	disabled = false,
	onChange,
	options,
	segmented = false,
	title,
	value,
}: SettingsPickerProps<T>) {
	const theme = useFormTheme()
	return (
		<Picker
			label={title}
			modifiers={[
				pickerStyle(segmented ? "segmented" : "menu"),
				...(segmented ? [labelsHidden()] : []),
				disabledModifier(disabled),
				...theme.row,
			]}
			onSelectionChange={(selection) => onChange(selection as T)}
			selection={value}
		>
			{options.map((option) => (
				<Text key={String(option.value)} modifiers={[tag(option.value)]}>
					{option.label}
				</Text>
			))}
		</Picker>
	)
}

export function SettingsSlider({
	max,
	min,
	onChange,
	step = 1,
	title,
	value,
	valueLabel,
}: SettingsSliderProps) {
	const theme = useFormTheme()
	return (
		<VStack alignment="leading" modifiers={theme.row} spacing={8}>
			<HStack>
				<Text>{title}</Text>
				<Spacer />
				{valueLabel ? <Text modifiers={[theme.secondary]}>{valueLabel}</Text> : null}
			</HStack>
			<Slider
				max={max}
				modifiers={[theme.toggle]}
				maximumValueLabel={<Text modifiers={[font({ size: 20 }), theme.secondary]}>A</Text>}
				min={min}
				minimumValueLabel={<Text modifiers={[font({ size: 13 }), theme.secondary]}>A</Text>}
				onValueChange={(next) => {
					const rounded = Math.round(next / step) * step
					if (rounded !== value) onChange(rounded)
				}}
				step={step}
				value={value}
			/>
		</VStack>
	)
}

export function SettingsTextField({
	defaultValue,
	numeric = false,
	onCommit,
	placeholder,
	subtitle,
	title,
}: SettingsTextFieldProps) {
	const text = useNativeState(defaultValue)
	const latest = useRef(defaultValue)
	const theme = useFormTheme()
	return (
		<VStack alignment="leading" modifiers={theme.row} spacing={4}>
			<Text>{title}</Text>
			{subtitle ? (
				<Text modifiers={[font({ textStyle: "footnote" }), theme.secondary]}>{subtitle}</Text>
			) : null}
			<TextField
				modifiers={[
					keyboardType(numeric ? "decimal-pad" : "default"),
					autocorrectionDisabled(),
					textInputAutocapitalization("never"),
					submitLabel("done"),
				]}
				onFocusChange={(focused) => {
					if (!focused) onCommit(latest.current)
				}}
				onTextChange={(next) => {
					latest.current = next
				}}
				placeholder={placeholder}
				text={text}
			/>
		</VStack>
	)
}
