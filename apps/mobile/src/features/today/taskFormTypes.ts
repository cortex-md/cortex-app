import type { ReactNode } from "react"

import type { SymbolName } from "@/components/ui/Symbol"

export interface ChoiceOption<T extends string> {
	label: string
	value: T
}

export interface TaskFormProps {
	autoFocus?: boolean
	children: ReactNode
	initialTitle: string
	onSubmitTitle?: () => void
	onTitleChange: (title: string) => void
	placeholder: string
}

export interface ChoiceRowProps<T extends string> {
	disabled?: boolean
	icon?: SymbolName
	onChange: (value: T) => void
	options: ChoiceOption<T>[]
	title: string
	value: T
}

export interface DateRowProps {
	icon?: SymbolName
	onChange: (date: string | undefined) => void
	title: string
	today: string
	value: string | undefined
}
