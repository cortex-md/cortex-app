import type { SymbolName } from "@/components/ui/Symbol"

export interface FloatingActionButtonProps {
	accessibilityLabel?: string
	icon: SymbolName
	label: string
	onPress: () => void
}
