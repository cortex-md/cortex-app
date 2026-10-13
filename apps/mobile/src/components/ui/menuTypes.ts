import type { ImageProps } from "@expo/ui/swift-ui"
import type { LucideIcon } from "lucide-react-native"

export type SFSymbol = NonNullable<ImageProps["systemName"]>

export interface MenuIcon {
	sf: SFSymbol
	Lucide: LucideIcon
}

export interface MenuItem {
	key: string
	label: string
	subtitle?: string
	icon?: MenuIcon
	checked?: boolean
	destructive?: boolean
	disabled?: boolean
	onPress: () => void
}

export type MenuGroup = MenuItem[]

export interface NativeMenuProps {
	accessibilityLabel: string
	groups: MenuGroup[]
	header?: string
	icon?: MenuIcon
	title?: string
	anchorStyle?: "glass" | "plain"
}
