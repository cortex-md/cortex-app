import {
	DateTimePicker,
	DropdownMenu,
	DropdownMenuItem,
	Text,
	TextField,
	useNativeState,
} from "@expo/ui/jetpack-compose"
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers"
import { useState } from "react"

import { FormRow } from "@/components/ui/Form"
import type {
	PropertyDatePickerProps,
	PropertyKeyboard,
	PropertyPickerProps,
	PropertyTextFieldProps,
} from "@/features/properties/propertyControlTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

function keyboardFor(keyboard: PropertyKeyboard) {
	switch (keyboard) {
		case "number":
			return "decimal" as const
		case "email":
			return "email" as const
		case "url":
			return "uri" as const
		case "phone":
			return "phone" as const
		default:
			return "text" as const
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
	const { colors } = useMobileColors()
	const value = useNativeState(initialValue)
	const plain = keyboard !== "default"
	const submit = () => {
		const current = value.get()
		onCommit?.(current)
		onSubmit?.(current)
	}
	return (
		<TextField
			autoFocus={autoFocus}
			colors={{ focusedContainerColor: colors.cell, unfocusedContainerColor: colors.cell }}
			keyboardActions={{ onDone: submit }}
			keyboardOptions={{
				autoCorrectEnabled: !plain,
				capitalization: plain ? "none" : "sentences",
				imeAction: "done",
				keyboardType: keyboardFor(keyboard),
			}}
			modifiers={[fillMaxWidth()]}
			onFocusChanged={(focused) => {
				if (!focused) onCommit?.(value.get())
			}}
			onValueChange={onChangeText}
			singleLine
			value={value}
		>
			{label ? (
				<TextField.Label>
					<Text>{label}</Text>
				</TextField.Label>
			) : null}
			{placeholder ? (
				<TextField.Placeholder>
					<Text>{placeholder}</Text>
				</TextField.Placeholder>
			) : null}
		</TextField>
	)
}

export function PropertyPicker({ icon, onChange, options, title, value }: PropertyPickerProps) {
	const { colors } = useMobileColors()
	const [expanded, setExpanded] = useState(false)
	const selected = options.find((option) => option.value === value)
	return (
		<DropdownMenu
			color={colors.fill}
			expanded={expanded}
			onDismissRequest={() => setExpanded(false)}
		>
			<DropdownMenu.Trigger>
				<FormRow
					icon={icon}
					onPress={() => setExpanded(true)}
					title={title}
					value={selected?.label}
				/>
			</DropdownMenu.Trigger>
			<DropdownMenu.Items>
				{options.map((option) => {
					const color = option.value === value ? colors.tint : colors.label
					return (
						<DropdownMenuItem
							elementColors={{ textColor: color }}
							key={option.value}
							onClick={() => {
								setExpanded(false)
								onChange(option.value)
							}}
						>
							<DropdownMenuItem.Text>
								<Text color={color} style={{ typography: "bodyMedium" }}>
									{option.label}
								</Text>
							</DropdownMenuItem.Text>
						</DropdownMenuItem>
					)
				})}
			</DropdownMenu.Items>
		</DropdownMenu>
	)
}

export function PropertyDatePicker({ onChange, value }: PropertyDatePickerProps) {
	return (
		<DateTimePicker
			displayedComponents="date"
			initialDate={value ? value.toISOString() : null}
			onDateSelected={onChange}
			showVariantToggle={false}
			variant="picker"
		/>
	)
}
