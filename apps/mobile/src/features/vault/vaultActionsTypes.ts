import type { MenuGroup } from "@/components/ui/menuTypes"

export interface VaultActionsMenuProps {
	accessibilityLabel: string
	color: string
	groups: MenuGroup[]
	subtitle?: string
	title: string
	value?: string
}
