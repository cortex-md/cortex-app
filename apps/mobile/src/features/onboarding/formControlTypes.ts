import type { SymbolName } from "@/components/ui/Symbol"

export interface FormTextFieldProps {
	autoCapitalize?: "none" | "words" | "sentences"
	autoFocus?: boolean
	defaultValue?: string
	keyboard?: "default" | "email"
	label: string
	onChangeText: (value: string) => void
	onSubmit?: () => void
	placeholder?: string
	secure?: boolean
}

export interface FormPickerOption<T extends string> {
	label: string
	value: T
}

export interface FormPickerProps<T extends string> {
	icon?: SymbolName
	label: string
	onChange: (value: T) => void
	options: FormPickerOption<T>[]
	value: T
}

export interface FormButtonProps {
	disabled?: boolean
	label: string
	onPress: () => void
	variant?: "primary" | "secondary" | "plain"
}

export interface FormHeaderProps {
	subtitle?: string
	title: string
}

export interface FormCheckRowProps {
	checked: boolean
	disabled?: boolean
	icon?: SymbolName
	iconColor?: string
	onPress: () => void
	subtitle?: string
	title: string
	value?: string
}
