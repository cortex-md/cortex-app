import { reportAppError } from "@cortex/core"
import { Input } from "@cortex/ui"
import { type KeyboardEvent, useRef } from "react"

interface DatabaseTitleInputProps {
	value: string
	label: string
	className: string
	readOnly: boolean
	placeholder?: string
	autoFocus?: boolean
	autosize?: boolean
	onRename: (name: string) => Promise<unknown>
	onDone?: () => void
}

export function DatabaseTitleInput({
	value,
	label,
	className,
	readOnly,
	placeholder,
	autoFocus = false,
	autosize = true,
	onRename,
	onDone,
}: DatabaseTitleInputProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const commit = async () => {
		const input = inputRef.current
		if (!input) return
		const next = input.value.trim()
		if (!next || next === value) {
			input.value = value
			onDone?.()
			return
		}
		try {
			await onRename(next)
			onDone?.()
		} catch (error) {
			input.value = value
			await reportAppError({
				operation: "database.rename",
				source: "databases",
				cause: error,
				userMessage: error instanceof Error ? error.message : "The name could not be changed.",
				context: { value, next },
			})
		}
	}
	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault()
			event.currentTarget.blur()
		}
		if (event.key === "Escape") {
			event.preventDefault()
			event.currentTarget.value = value
			event.currentTarget.blur()
		}
	}
	const input = (
		<Input
			key={value}
			ref={inputRef}
			className={className}
			aria-label={label}
			defaultValue={value}
			placeholder={placeholder}
			readOnly={readOnly}
			spellCheck={false}
			autoFocus={autoFocus}
			onFocus={autoFocus ? (event) => event.currentTarget.select() : undefined}
			onKeyDown={handleKeyDown}
			onBlur={() => void commit()}
			onInput={
				autosize
					? (event) => {
							const wrapper = event.currentTarget.parentElement
							if (wrapper) wrapper.dataset.value = event.currentTarget.value
						}
					: undefined
			}
		/>
	)
	if (!autosize) return input
	return (
		<span className="db-autosize" data-value={value}>
			{input}
		</span>
	)
}
