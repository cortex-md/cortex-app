import type { SFSymbol } from "@/components/ui/menuTypes"
import type { LucideIcon } from "lucide-react-native"

export interface FloatingActionButtonProps {
	Icon: LucideIcon
	accessibilityLabel?: string
	label: string
	onPress: () => void
	sf: SFSymbol
}
