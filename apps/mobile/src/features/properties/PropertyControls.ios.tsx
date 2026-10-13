import { DatePicker, Picker, Text, TextField, useNativeState, VStack } from "@expo/ui/swift-ui"
import {
	autocorrectionDisabled,
	datePickerStyle,
	font,
	foregroundStyle,
	keyboardType,
	onSubmit as onSubmitModifier,
	pickerStyle,
	tag,
	textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers"

import type {
	PropertyDatePickerProps,
	PropertyKeyboard,
	PropertyPickerProps,
	PropertyTextFieldProps,
} from "@/features/properties/propertyControlTypes"

function keyboardFor(keyboard: PropertyKeyboard) {
	switch (keyboard) {
		case "number":
			return keyboardType("decimal-pad")
		case "email":
			return keyboardType("email-address")
		case "url":
			return keyboardType("url")
		case "phone":
			return keyboardType("phone-pad")
		default:
			return keyboardType("default")
	}
}

export function PropertyTextField({
	autoFocus = false,
	initialValue = "",
	keyboard = "default",
	label,
	onChangeText,
	onCommit,
	onSubmit,
	placeholder,
}: PropertyTextFieldProps) {
	const text = useNativeState(initialValue)
	const plain = keyboard !== "default"
	const modifiers = [
		textInputAutocapitalization(plain ? "never" : "sentences"),
		autocorrectionDisabled(plain),
		keyboardFor(keyboard),
		onSubmitModifier(() => {
			const value = text.get()
			onCommit?.(value)
			onSubmit?.(value)
		}),
	]
	const field = (
		<TextField
			autoFocus={autoFocus}
			modifiers={modifiers}
			onFocusChange={(focused) => {
				if (!focused) onCommit?.(text.get())
			}}
			onTextChange={onChangeText}
			placeholder={placeholder}
			text={text}
		/>
	)
	if (!label) return field
	return (
		<VStack alignment="leading" spacing={4}>
			<Text
				modifiers={[
					font({ textStyle: "footnote" }),
					foregroundStyle({ type: "hierarchical", style: "secondary" }),
				]}
			>
				{label}
			</Text>
			{field}
		</VStack>
	)
}

export function PropertyPicker({ icon, onChange, options, title, value }: PropertyPickerProps) {
	return (
		<Picker
			label={title}
			modifiers={[pickerStyle("menu")]}
			onSelectionChange={(selection) => onChange(String(selection))}
			selection={value}
			systemImage={icon?.sf}
		>
			{options.map((option) => (
				<Text key={option.value} modifiers={[tag(option.value)]}>
					{option.label}
				</Text>
			))}
		</Picker>
	)
}

export function PropertyDatePicker({ onChange, value }: PropertyDatePickerProps) {
	return (
		<DatePicker
			displayedComponents={["date"]}
			modifiers={[datePickerStyle("graphical")]}
			onDateChange={onChange}
			selection={value ?? new Date()}
			title="Date"
		/>
	)
}
