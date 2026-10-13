import type { StatusTone } from "@/components/ui/StatusPill"

export interface StatusPickerOption {
	id: string
	label: string
	tone: StatusTone
}

export interface StatusPickerProps {
	message: string
	onPresentedChange: (presented: boolean) => void
	onSelect: (id: string) => void
	options: StatusPickerOption[]
	presented: boolean
	title: string
	value?: string
}
