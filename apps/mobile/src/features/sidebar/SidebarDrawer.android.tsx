import type { PropsWithChildren, ReactNode, RefObject } from "react"
import { StyleSheet, useWindowDimensions, View } from "react-native"
import DrawerLayout from "react-native-gesture-handler/DrawerLayout"

import { useMobileColors } from "@/hooks/useMobileColors"

const DRAWER_WIDTH = 344
const EDGE_WIDTH = 24

interface SidebarDrawerProps extends PropsWithChildren {
	drawerRef: RefObject<DrawerLayout | null>
	renderContent: () => ReactNode
}

export function SidebarDrawer({ children, drawerRef, renderContent }: SidebarDrawerProps) {
	const { colors } = useMobileColors()
	const { width } = useWindowDimensions()
	const drawerWidth = Math.min(DRAWER_WIDTH, width - 56)

	return (
		<DrawerLayout
			ref={drawerRef}
			drawerBackgroundColor="transparent"
			drawerLockMode="unlocked"
			drawerPosition="left"
			drawerType="front"
			drawerWidth={drawerWidth}
			edgeWidth={EDGE_WIDTH}
			keyboardDismissMode="on-drag"
			overlayColor={colors.scrim}
			renderNavigationView={() => (
				<View style={[styles.drawer, { backgroundColor: colors.sidebarBackground }]}>
					{renderContent()}
				</View>
			)}
			useNativeAnimations
		>
			{children}
		</DrawerLayout>
	)
}

const styles = StyleSheet.create({
	drawer: {
		borderBottomRightRadius: 16,
		borderTopRightRadius: 16,
		flex: 1,
		overflow: "hidden",
	},
})
