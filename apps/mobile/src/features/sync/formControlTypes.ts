import type { MenuGroup } from "@/components/ui/menuTypes"

export type FormKeyboard = "default" | "email" | "url"

export interface FormTextFieldProps {
	autoFocus?: boolean
	initialValue?: string
	keyboard?: FormKeyboard
	label?: string
	monospace?: boolean
	onChangeText?: (value: string) => void
	onCommit?: (value: string) => void
	onSubmit?: () => void
	placeholder?: string
	secure?: boolean
}

export interface FormMenuProps {
	accessibilityLabel: string
	groups: MenuGroup[]
	label: string
}

export interface FormCheckProps {
	checked: boolean
}
