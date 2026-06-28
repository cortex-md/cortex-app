import type { ComponentType, ReactNode } from "react"

export interface SettingsControlComponents {
	Group?: ComponentType<{ children: ReactNode }>
	Field?: ComponentType<{
		label: ReactNode
		description?: ReactNode
		children: ReactNode
	}>
	Switch: ComponentType<{ checked: boolean; onCheckedChange: (value: boolean) => void }>
	TextInput: ComponentType<{
		value: string
		onChange: (value: string) => void
		placeholder?: string
	}>
	NumberInput: ComponentType<{
		value: number
		onChange: (value: number) => void
		min?: number
		max?: number
		step?: number
	}>
	Select: ComponentType<{
		value: string
		onChange: (value: string) => void
		options: { value: string; label: string }[]
	}>
	Slider: ComponentType<{
		value: number
		onChange: (value: number) => void
		min: number
		max: number
		step: number
	}>
	ColorPicker: ComponentType<{ value: string; onChange: (value: string) => void }>
	Label: ComponentType<{ children: ReactNode }>
	Description: ComponentType<{ children: ReactNode }>
}

let controls: SettingsControlComponents | null = null

export function setSettingsControls(components: SettingsControlComponents): void {
	controls = components
}

export function getSettingsControls(): SettingsControlComponents {
	if (!controls) {
		throw new Error("Settings controls not initialized. Call setSettingsControls() first.")
	}
	return controls
}
