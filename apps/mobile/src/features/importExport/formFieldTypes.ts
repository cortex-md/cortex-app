import type { SymbolName } from "@/components/ui/Symbol"

export interface FormTextFieldProps {
	disabled?: boolean
	initialValue: string
	label: string
	monospace?: boolean
	multiline?: boolean
	onChangeText: (value: string) => void
	placeholder?: string
}

export interface FormPickerOption<T extends string> {
	label: string
	value: T
}

export interface FormPickerProps<T extends string> {
	label: string
	onChange: (value: T) => void
	options: FormPickerOption<T>[]
	segmented?: boolean
	value: T
}

export interface FormChoiceRowProps {
	disabled?: boolean
	icon?: SymbolName
	onPress: () => void
	selected: boolean
	subtitle?: string
	title: string
}

export interface FormProgressProps {
	label: string
	value: number
}

export interface FormTextProps {
	monospace?: boolean
	secondary?: boolean
	text: string
}
