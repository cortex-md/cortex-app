import type { MenuGroup } from "@/components/ui/menuTypes"
import type { SymbolName } from "@/components/ui/Symbol"

export interface NoteBottomMenuProps {
	groups: MenuGroup[]
}

export interface KeyboardToolbarAction {
	key: string
	label: string
	icon: SymbolName
	onPress: () => void
}

export interface KeyboardToolbarProps {
	actions: KeyboardToolbarAction[]
	more: MenuGroup[]
	onHideKeyboard: () => void
}

export interface NotePropertiesRowProps {
	count: number
	onPress: () => void
}
