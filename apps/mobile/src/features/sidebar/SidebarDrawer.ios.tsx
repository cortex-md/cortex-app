import type { PropsWithChildren, ReactNode, RefObject } from "react"
import { Animated, StyleSheet, useWindowDimensions, View } from "react-native"
import DrawerLayout from "react-native-gesture-handler/DrawerLayout"

import { useMobileColors } from "@/hooks/useMobileColors"

const DRAWER_WIDTH = 320
const EDGE_WIDTH = 28
const CONTENT_RADIUS = 55

interface SidebarDrawerProps extends PropsWithChildren {
	drawerRef: RefObject<DrawerLayout | null>
	renderContent: () => ReactNode
}

export function SidebarDrawer({ children, drawerRef, renderContent }: SidebarDrawerProps) {
	const { colors } = useMobileColors()
	const { width } = useWindowDimensions()
	const drawerWidth = Math.min(DRAWER_WIDTH, width - 72)

	return (
		<DrawerLayout
			ref={drawerRef}
			drawerBackgroundColor={colors.groupedBackground}
			drawerLockMode="unlocked"
			drawerPosition="left"
			drawerType="back"
			drawerWidth={drawerWidth}
			edgeWidth={EDGE_WIDTH}
			keyboardDismissMode="on-drag"
			overlayColor="transparent"
			renderNavigationView={(progress) => (
				<Animated.View
					style={[
						styles.drawer,
						{
							backgroundColor: colors.groupedBackground,
							opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
							transform: [
								{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-32, 0] }) },
							],
						},
					]}
				>
					{renderContent()}
				</Animated.View>
			)}
			useNativeAnimations
		>
			{(openValue) => (
				<Animated.View
					style={[
						styles.content,
						{
							backgroundColor: colors.groupedBackground,
							borderRadius: openValue
								? openValue.interpolate({
										extrapolate: "clamp",
										inputRange: [0, 0.25, 1],
										outputRange: [0, CONTENT_RADIUS, CONTENT_RADIUS],
									})
								: 0,
							boxShadow: `-12px 0 40px ${colors.shadow}`,
						},
					]}
				>
					<View style={styles.content}>{children}</View>
					<Animated.View
						pointerEvents="none"
						style={[
							StyleSheet.absoluteFill,
							{
								backgroundColor: colors.scrim,
								opacity: openValue
									? openValue.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] })
									: 0,
							},
						]}
					/>
				</Animated.View>
			)}
		</DrawerLayout>
	)
}

const styles = StyleSheet.create({
	content: {
		borderCurve: "continuous",
		flex: 1,
		overflow: "hidden",
	},
	drawer: {
		flex: 1,
	},
})
