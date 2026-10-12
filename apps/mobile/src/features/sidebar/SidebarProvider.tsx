import { type PropsWithChildren, useRef } from "react"
import DrawerLayout from "react-native-gesture-handler/DrawerLayout"

import { MobileSidebarContext } from "@/features/sidebar/useMobileSidebar"
import { useSidebarDrawer } from "@/features/sidebar/useSidebarDrawer"

export function SidebarProvider({ children }: PropsWithChildren) {
	const drawerRef = useRef<DrawerLayout>(null)

	function closeSidebar() {
		drawerRef.current?.closeDrawer()
	}

	function openSidebar() {
		drawerRef.current?.openDrawer()
	}

	const { drawerBackgroundColor, drawerWidth, renderSidebar } = useSidebarDrawer(closeSidebar)

	return (
		<MobileSidebarContext.Provider value={{ closeSidebar, openSidebar }}>
			<DrawerLayout
				ref={drawerRef}
				drawerBackgroundColor={drawerBackgroundColor}
				drawerLockMode="unlocked"
				drawerPosition="left"
				drawerType="front"
				drawerWidth={drawerWidth}
				edgeWidth={32}
				keyboardDismissMode="on-drag"
				overlayColor="rgba(0,0,0,0.32)"
				renderNavigationView={renderSidebar}
				useNativeAnimations
			>
				{children}
			</DrawerLayout>
		</MobileSidebarContext.Provider>
	)
}
