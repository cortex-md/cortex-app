import type { SFSymbol as ExpoSFSymbol } from "expo-symbols"

import type { SymbolName } from "@/components/ui/Symbol"

export type SFSymbol = ExpoSFSymbol

export type MenuIcon = SymbolName

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
