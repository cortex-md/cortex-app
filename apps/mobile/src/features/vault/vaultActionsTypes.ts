import type { MenuGroup } from "@/components/ui/menuTypes"

export interface VaultActionsMenuProps {
	accessibilityLabel: string
	groups: MenuGroup[]
	message: string
	onPresentedChange: (presented: boolean) => void
	presented: boolean
	title: string
}
