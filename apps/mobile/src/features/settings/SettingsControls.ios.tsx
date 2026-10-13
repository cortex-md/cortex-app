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
	foregroundStyle,
	keyboardType,
	labelsHidden,
	pickerStyle,
	submitLabel,
	tag,
	textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers"
import { useRef } from "react"

import type {
	SettingsOptionValue,
	SettingsPickerProps,
	SettingsSliderProps,
	SettingsTextFieldProps,
} from "@/features/settings/settingsControlTypes"

const secondary = foregroundStyle({ type: "hierarchical", style: "secondary" })

export function SettingsPicker<T extends SettingsOptionValue>({
	disabled = false,
	onChange,
	options,
	segmented = false,
	title,
	value,
}: SettingsPickerProps<T>) {
	return (
		<Picker
			label={title}
			modifiers={[
				pickerStyle(segmented ? "segmented" : "menu"),
				...(segmented ? [labelsHidden()] : []),
				disabledModifier(disabled),
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
	return (
		<VStack alignment="leading" spacing={8}>
			<HStack>
				<Text>{title}</Text>
				<Spacer />
				{valueLabel ? <Text modifiers={[secondary]}>{valueLabel}</Text> : null}
			</HStack>
			<Slider
				max={max}
				maximumValueLabel={<Text modifiers={[font({ size: 20 }), secondary]}>A</Text>}
				min={min}
				minimumValueLabel={<Text modifiers={[font({ size: 13 }), secondary]}>A</Text>}
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
	return (
		<VStack alignment="leading" spacing={4}>
			<Text>{title}</Text>
			{subtitle ? (
				<Text modifiers={[font({ textStyle: "footnote" }), secondary]}>{subtitle}</Text>
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
