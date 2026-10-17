import { parseIsoDate, toIsoDate } from "@cortex/tasks"
import { DatePicker, Picker, Text, TextField, useNativeState } from "@expo/ui/swift-ui"
import {
	datePickerStyle,
	disabled as disabledModifier,
	onSubmit,
	pickerStyle,
	submitLabel,
	tag,
} from "@expo/ui/swift-ui/modifiers"

import { FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { useFormTheme } from "@/components/ui/formTheme"
import type { ChoiceRowProps, DateRowProps, TaskFormProps } from "@/features/today/taskFormTypes"

export function TaskForm({
	autoFocus = false,
	children,
	initialTitle,
	onSubmitTitle,
	onTitleChange,
	placeholder,
}: TaskFormProps) {
	const text = useNativeState(initialTitle)
	const theme = useFormTheme()
	return (
		<NativeForm>
			<FormSection>
				<TextField
					autoFocus={autoFocus}
					modifiers={[submitLabel("done"), onSubmit(() => onSubmitTitle?.()), ...theme.row]}
					onTextChange={onTitleChange}
					placeholder={placeholder}
					text={text}
				/>
			</FormSection>
			{children}
		</NativeForm>
	)
}

export function ChoiceRow<T extends string>({
	disabled = false,
	icon,
	onChange,
	options,
	title,
	value,
}: ChoiceRowProps<T>) {
	const theme = useFormTheme()
	return (
		<Picker
			label={title}
			modifiers={[pickerStyle("menu"), disabledModifier(disabled), ...theme.row]}
			onSelectionChange={(selection) => onChange(selection as T)}
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

export function DateRow({ icon, onChange, title, today, value }: DateRowProps) {
	const theme = useFormTheme()
	return (
		<>
			<FormToggle
				icon={icon}
				onValueChange={(on) => onChange(on ? (value ?? today) : undefined)}
				title={title}
				value={value !== undefined}
			/>
			{value ? (
				<DatePicker
					displayedComponents={["date"]}
					modifiers={[datePickerStyle("compact"), ...theme.row]}
					onDateChange={(date) => onChange(toIsoDate(date))}
					selection={parseIsoDate(value)}
					title="Date"
				/>
			) : null}
		</>
	)
}
