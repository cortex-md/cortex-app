import type { Href } from "expo-router"
import type { ReactElement } from "react"
import type { GestureResponderEvent } from "react-native"

import type { MenuGroup } from "@/components/ui/menuTypes"

export interface EntryContextMenuTrigger {
	onLongPress?: (event: GestureResponderEvent) => void
	onPress?: () => void
}

export interface EntryContextMenuProps {
	children: (trigger: EntryContextMenuTrigger) => ReactElement
	groups: MenuGroup[]
	header?: string
	href: Href
	onPress: () => void
}
