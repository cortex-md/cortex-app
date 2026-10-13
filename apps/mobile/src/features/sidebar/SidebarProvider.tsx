import { type PropsWithChildren, useCallback, useRef } from "react"
import type DrawerLayout from "react-native-gesture-handler/DrawerLayout"

import { SidebarContent } from "@/features/sidebar/SidebarContent"
import { SidebarDrawer } from "@/features/sidebar/SidebarDrawer"
import { MobileSidebarContext } from "@/features/sidebar/useMobileSidebar"

export function SidebarProvider({ children }: PropsWithChildren) {
	const drawerRef = useRef<DrawerLayout>(null)

	const closeSidebar = useCallback(() => {
		drawerRef.current?.closeDrawer()
	}, [])

	const openSidebar = useCallback(() => {
		drawerRef.current?.openDrawer()
	}, [])

	return (
		<MobileSidebarContext.Provider value={{ closeSidebar, openSidebar }}>
			<SidebarDrawer
				drawerRef={drawerRef}
				renderContent={() => <SidebarContent closeSidebar={closeSidebar} />}
			>
				{children}
			</SidebarDrawer>
		</MobileSidebarContext.Provider>
	)
}
