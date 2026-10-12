import { Input } from "@cortex/ui"
import type { ChangeEvent } from "react"

const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

interface TimeFieldProps {
	id?: string
	value: string
	disabled?: boolean
	ariaLabel?: string
	onChange: (value: string) => void
}

export function TimeField({ id, value, disabled, ariaLabel, onChange }: TimeFieldProps) {
	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		const nextValue = event.target.value
		if (CLOCK_TIME_PATTERN.test(nextValue) && nextValue !== value) onChange(nextValue)
	}

	return (
		<Input
			id={id}
			type="time"
			size="sm"
			className="task-time-field"
			value={value}
			disabled={disabled}
			aria-label={ariaLabel}
			onChange={handleChange}
		/>
	)
}
