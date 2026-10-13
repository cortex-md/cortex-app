import type { ReactNode } from "react"

import type { SymbolName } from "@/components/ui/Symbol"

export interface NativeFormProps {
	children: ReactNode
}

export interface FormSectionProps {
	children: ReactNode
	footer?: string
	title?: string
}

export interface FormRowProps {
	chevron?: boolean
	destructive?: boolean
	disabled?: boolean
	icon?: SymbolName
	onPress?: () => void
	subtitle?: string
	tint?: boolean
	title: string
	trailing?: ReactNode
	value?: string
}

export interface FormToggleProps {
	disabled?: boolean
	icon?: SymbolName
	onValueChange: (value: boolean) => void
	subtitle?: string
	title: string
	value: boolean
}
