export type SettingsOptionValue = string | number

export interface SettingsOption<T extends SettingsOptionValue> {
	label: string
	value: T
}

export interface SettingsPickerProps<T extends SettingsOptionValue> {
	disabled?: boolean
	onChange: (value: T) => void
	options: readonly SettingsOption<T>[]
	segmented?: boolean
	title: string
	value: T
}

export interface SettingsSliderProps {
	max: number
	min: number
	onChange: (value: number) => void
	step?: number
	title: string
	value: number
	valueLabel?: string
}

export interface SettingsTextFieldProps {
	defaultValue: string
	numeric?: boolean
	onCommit: (text: string) => void
	placeholder?: string
	subtitle?: string
	title: string
}
