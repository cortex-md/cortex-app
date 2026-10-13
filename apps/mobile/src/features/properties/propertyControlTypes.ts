import type { SymbolName } from "@/components/ui/Symbol"

export type PropertyKeyboard = "default" | "number" | "email" | "url" | "phone"

export interface PropertyTextFieldProps {
	autoFocus?: boolean
	initialValue?: string
	keyboard?: PropertyKeyboard
	label?: string
	onChangeText?: (value: string) => void
	onCommit?: (value: string) => void
	onSubmit?: (value: string) => void
	placeholder?: string
}

export interface PropertyPickerOption {
	label: string
	value: string
}

export interface PropertyPickerProps {
	icon?: SymbolName
	onChange: (value: string) => void
	options: PropertyPickerOption[]
	title: string
	value: string
}

export interface PropertyDatePickerProps {
	onChange: (date: Date) => void
	value: Date | null
}
