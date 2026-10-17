export interface ImpactCell {
	label: string
	value: string
}

export interface ConfirmDialogProps {
	cancelLabel?: string
	confirmLabel: string
	destructive?: boolean
	impact?: ImpactCell[]
	message?: string
	onCancel: () => void
	onConfirm: () => void
	title: string
	typedName?: string
	visible: boolean
}

export interface TextPromptDialogProps {
	cancelLabel?: string
	confirmLabel: string
	error?: string | null
	initialValue?: string
	message?: string
	onCancel: () => void
	onChangeText?: (value: string) => void
	onConfirm: (value: string) => void
	placeholder?: string
	title: string
	visible: boolean
}
