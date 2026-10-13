import type { PropsWithChildren, ReactNode, RefObject } from "react"
import type DrawerLayout from "react-native-gesture-handler/DrawerLayout"

interface SidebarDrawerProps extends PropsWithChildren {
	drawerRef: RefObject<DrawerLayout | null>
	renderContent: () => ReactNode
}

export function SidebarDrawer({ children }: SidebarDrawerProps) {
	return <>{children}</>
}
