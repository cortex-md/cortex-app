import {
	ColorPicker,
	Input,
	Label,
	NativeSelect,
	NativeSelectOption,
	Slider,
	Switch,
} from "@cortex/ui"
import { type ChangeEvent, type FocusEvent, type ReactNode, useState } from "react"
import { SettingsField, SettingsGroup } from "./SettingsPrimitives"

export function DesktopSwitch({
	checked,
	onCheckedChange,
}: {
	checked: boolean
	onCheckedChange: (value: boolean) => void
}) {
	return <Switch checked={checked} onCheckedChange={onCheckedChange} />
}

export function DesktopTextInput({
	value,
	onChange,
	placeholder,
}: {
	value: string
	onChange: (value: string) => void
	placeholder?: string
}) {
	return (
		<Input
			key={value}
			defaultValue={value}
			placeholder={placeholder}
			onBlur={(event: FocusEvent<HTMLInputElement>) => {
				const nextValue = event.currentTarget.value
				if (nextValue !== value) onChange(nextValue)
			}}
		/>
	)
}

export function DesktopNumberInput({
	value,
	onChange,
	min,
	max,
	step,
}: {
	value: number
	onChange: (value: number) => void
	min?: number
	max?: number
	step?: number
}) {
	return (
		<Input
			type="number"
			className="w-24"
			value={value}
			min={min}
			max={max}
			step={step}
			onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
		/>
	)
}

export function DesktopSelect({
	value,
	onChange,
	options,
}: {
	value: string
	onChange: (value: string) => void
	options: { value: string; label: string }[]
}) {
	return (
		<NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
			{options.map((opt) => (
				<NativeSelectOption key={opt.value} value={opt.value}>
					{opt.label}
				</NativeSelectOption>
			))}
		</NativeSelect>
	)
}

export function DesktopSlider({
	value,
	onChange,
	min,
	max,
	step,
}: {
	value: number
	onChange: (value: number) => void
	min: number
	max: number
	step: number
}) {
	return (
		<DesktopSliderDraft
			key={value}
			initialValue={value}
			onChange={onChange}
			min={min}
			max={max}
			step={step}
		/>
	)
}

function DesktopSliderDraft({
	initialValue,
	onChange,
	min,
	max,
	step,
}: {
	initialValue: number
	onChange: (value: number) => void
	min: number
	max: number
	step: number
}) {
	const [draftValue, setDraftValue] = useState(initialValue)

	const handleCommit = (nextValue: number) => {
		setDraftValue(nextValue)
		if (nextValue !== initialValue) onChange(nextValue)
	}

	return (
		<div className="flex w-full min-w-0 items-center gap-3">
			<Slider
				className="min-w-32 flex-1"
				value={[draftValue]}
				min={min}
				max={max}
				step={step}
				onValueChange={([nextValue]) => setDraftValue(nextValue)}
				onValueCommit={([nextValue]) => handleCommit(nextValue)}
			/>
			<span className="text-sm text-muted-foreground w-10 text-right">{draftValue}</span>
		</div>
	)
}

export function DesktopColorPicker({
	value,
	onChange,
}: {
	value: string
	onChange: (value: string) => void
}) {
	return <ColorPicker value={value} onChange={(color) => onChange(color ?? value)} />
}

export function DesktopLabel({ children }: { children: ReactNode }) {
	return <Label>{children}</Label>
}

export function DesktopDescription({ children }: { children: ReactNode }) {
	return <p className="text-xs text-muted-foreground">{children}</p>
}

export function DesktopGroup({ children }: { children: ReactNode }) {
	return <SettingsGroup>{children}</SettingsGroup>
}

export function DesktopField({
	label,
	description,
	children,
}: {
	label: ReactNode
	description?: ReactNode
	children: ReactNode
}) {
	return (
		<SettingsField label={label} description={description}>
			{children}
		</SettingsField>
	)
}
