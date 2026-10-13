import { Host } from "@expo/ui"
import { ExtendedFloatingActionButton, RNHostView, Text } from "@expo/ui/jetpack-compose"
import { useState } from "react"
import { Pressable, StyleSheet, Text as RNText, View } from "react-native"
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated"

import { Symbol } from "@/components/ui/Symbol"
import type { CreateFabMenuProps } from "@/features/files/CreateFabMenu"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

export function CreateFabMenu({ groups }: CreateFabMenuProps) {
	const { colors } = useMobileColors()
	const [open, setOpen] = useState(false)
	const items = groups.flat()

	function toggle() {
		triggerSelectionHaptic()
		setOpen((current) => !current)
	}

	return (
		<>
			{open ? (
				<Animated.View
					entering={FadeIn.duration(160)}
					exiting={FadeOut.duration(160)}
					style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
				>
					<Pressable accessibilityLabel="Close menu" onPress={toggle} style={styles.flex} />
				</Animated.View>
			) : null}
			<View pointerEvents="box-none" style={styles.anchor}>
				{open ? (
					<Animated.View
						entering={SlideInDown.duration(220)}
						exiting={SlideOutDown.duration(180)}
						style={styles.speedDial}
					>
						{items.map((item) => (
							<Pressable
								accessibilityRole="button"
								android_ripple={{ color: colors.hover }}
								key={item.key}
								onPress={() => {
									setOpen(false)
									item.onPress()
								}}
								style={[styles.pill, { backgroundColor: colors.accentSubtle }]}
							>
								{item.icon ? <Symbol color={colors.tint} name={item.icon} size={22} /> : null}
								<RNText style={[styles.pillLabel, { color: colors.tint }]}>{item.label}</RNText>
							</Pressable>
						))}
					</Animated.View>
				) : null}
				<Host matchContents>
					<ExtendedFloatingActionButton
						containerColor={colors.accentSubtle}
						expanded={!open}
						onClick={toggle}
					>
						<ExtendedFloatingActionButton.Icon>
							<RNHostView matchContents>
								<View style={styles.fabIcon}>
									<Symbol
										color={colors.tint}
										name={open ? { sf: "xmark", md: "close" } : { sf: "plus", md: "add" }}
										size={24}
									/>
								</View>
							</RNHostView>
						</ExtendedFloatingActionButton.Icon>
						<ExtendedFloatingActionButton.Text>
							<Text color={colors.tint}>New</Text>
						</ExtendedFloatingActionButton.Text>
					</ExtendedFloatingActionButton>
				</Host>
			</View>
		</>
	)
}

const styles = StyleSheet.create({
	anchor: {
		alignItems: "flex-end",
		bottom: 120,
		gap: 16,
		position: "absolute",
		right: 16,
	},
	fabIcon: {
		alignItems: "center",
		height: 24,
		justifyContent: "center",
		width: 24,
	},
	flex: {
		flex: 1,
	},
	pill: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 16,
		flexDirection: "row",
		gap: 12,
		height: 56,
		paddingHorizontal: 20,
	},
	pillLabel: {
		fontSize: 16,
		fontWeight: "500",
		letterSpacing: 0.1,
		lineHeight: 24,
	},
	speedDial: {
		alignItems: "flex-end",
		gap: 12,
	},
})
