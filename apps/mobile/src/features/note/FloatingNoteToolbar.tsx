import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect"
import { FileSearch, FileText, MessageSquare, SquarePen } from "lucide-react-native"
import { type ReactNode, useEffect, useState } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"
import Animated, {
	Easing,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated"

import { workspaceChannel } from "@/features/workspace/workspaceChannel"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const COLLAPSE_AFTER_PX = 24
const COLLAPSE_EASING = Easing.bezier(0.32, 0.72, 0, 1)
const GLASS_AVAILABLE = IS_IOS && isLiquidGlassAvailable()

export const FLOATING_TOOLBAR_HEIGHT = IS_IOS ? 92 : 96

interface FloatingNoteToolbarProps {
	commentCount: number | null
	onComments: () => void
	onFind: () => void
	onNewNote: () => void
	onTabs: () => void
	tabCount: number
	title: string
}

function useCollapsedOnScroll() {
	const [collapsed, setCollapsed] = useState(false)
	useEffect(
		() =>
			workspaceChannel.subscribeScroll(({ direction, offset }) => {
				setCollapsed(offset >= COLLAPSE_AFTER_PX && direction === "down")
			}),
		[],
	)
	return [collapsed, setCollapsed] as const
}

function Glass({ children, style }: { children: ReactNode; style: object }) {
	const { colors } = useMobileColors()
	return (
		<GlassView
			glassEffectStyle="regular"
			isInteractive
			style={[
				style,
				GLASS_AVAILABLE
					? null
					: {
							backgroundColor: colors.glass,
							borderColor: colors.glassEdge,
							borderWidth: StyleSheet.hairlineWidth,
						},
			]}
		>
			{children}
		</GlassView>
	)
}

function TabsCount({ count, color }: { count: number; color: string }) {
	return (
		<View style={[styles.tabsCount, { borderColor: color }]}>
			<Text style={[styles.tabsCountLabel, { color }]}>{count}</Text>
		</View>
	)
}

export function FloatingNoteToolbar(props: FloatingNoteToolbarProps) {
	const [collapsed, setCollapsed] = useCollapsedOnScroll()
	const progress = useSharedValue(0)

	useEffect(() => {
		progress.set(withTiming(collapsed ? 1 : 0, { duration: 360, easing: COLLAPSE_EASING }))
	}, [collapsed, progress])

	const fullStyle = useAnimatedStyle(() => ({
		opacity: 1 - progress.value,
		transform: IS_IOS
			? [
					{ translateY: interpolate(progress.value, [0, 1], [0, 70]) },
					{ scale: interpolate(progress.value, [0, 1], [1, 0.86]) },
				]
			: [{ translateY: interpolate(progress.value, [0, 1], [0, 120]) }],
	}))
	const miniStyle = useAnimatedStyle(() => ({
		opacity: progress.value,
		transform: [
			{ translateY: interpolate(progress.value, [0, 1], [24, 0]) },
			{ scale: interpolate(progress.value, [0, 1], [0.7, 1]) },
		],
	}))

	return (
		<View style={styles.area}>
			<Animated.View
				accessibilityElementsHidden={collapsed}
				pointerEvents={collapsed ? "none" : "auto"}
				style={[styles.full, fullStyle]}
			>
				{IS_IOS ? <IosToolbar {...props} /> : <AndroidToolbar {...props} />}
			</Animated.View>
			{IS_IOS ? (
				<Animated.View
					pointerEvents={collapsed ? "auto" : "none"}
					style={[styles.miniWrap, miniStyle]}
				>
					<MiniPill onPress={() => setCollapsed(false)} title={props.title} />
				</Animated.View>
			) : null}
		</View>
	)
}

function MiniPill({ onPress, title }: { onPress: () => void; title: string }) {
	const { colors } = useMobileColors()
	return (
		<Pressable accessibilityLabel="Show toolbar" accessibilityRole="button" onPress={onPress}>
			<Glass style={styles.mini}>
				<FileText color={colors.label} size={14} strokeWidth={2.6} />
				<Text numberOfLines={1} style={[styles.miniLabel, { color: colors.label }]}>
					{title}
				</Text>
			</Glass>
		</Pressable>
	)
}

function IosToolbar({
	commentCount,
	onComments,
	onFind,
	onNewNote,
	onTabs,
	tabCount,
}: FloatingNoteToolbarProps) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.iosRow}>
			<Pressable accessibilityLabel={`${tabCount} open tabs`} onPress={onTabs}>
				<Glass style={styles.square}>
					<TabsCount color={colors.label} count={tabCount} />
				</Glass>
			</Pressable>
			{commentCount === null ? (
				<Pressable accessibilityLabel="Quick finder" onPress={onFind} style={styles.flex}>
					<Glass style={styles.pill}>
						<FileSearch color={colors.secondaryLabel} size={20} strokeWidth={2} />
						<Text numberOfLines={1} style={[styles.pillLabel, { color: colors.secondaryLabel }]}>
							Find or create a note...
						</Text>
					</Glass>
				</Pressable>
			) : (
				<Pressable accessibilityLabel="Comments" onPress={onComments} style={styles.flex}>
					<Glass style={[styles.pill, styles.pillCenter]}>
						<MessageSquare color={colors.label} size={20} strokeWidth={2} />
						<Text numberOfLines={1} style={[styles.pillLabel, { color: colors.label }]}>
							{`Comments · ${commentCount}`}
						</Text>
					</Glass>
				</Pressable>
			)}
			<Pressable
				accessibilityLabel={commentCount === null ? "New note" : "Quick finder"}
				onPress={commentCount === null ? onNewNote : onFind}
			>
				<Glass style={styles.square}>
					{commentCount === null ? (
						<SquarePen color={colors.label} size={22} strokeWidth={2} />
					) : (
						<FileSearch color={colors.label} size={22} strokeWidth={2} />
					)}
				</Glass>
			</Pressable>
		</View>
	)
}

function AndroidToolbar({
	commentCount,
	onComments,
	onFind,
	onNewNote,
	onTabs,
	tabCount,
}: FloatingNoteToolbarProps) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.androidRow}>
			<View style={[styles.androidPill, { backgroundColor: colors.fill }]}>
				{commentCount === null ? (
					<Pressable
						accessibilityLabel="Quick finder"
						android_ripple={{ color: colors.hover }}
						onPress={onFind}
						style={[styles.androidField, { backgroundColor: colors.fill2 }]}
					>
						<FileSearch color={colors.secondaryLabel} size={22} strokeWidth={2} />
						<Text numberOfLines={1} style={[styles.androidFieldLabel, { color: colors.secondaryLabel }]}>
							Find or create a note...
						</Text>
					</Pressable>
				) : (
					<Pressable
						accessibilityLabel="Comments"
						android_ripple={{ color: colors.hover }}
						onPress={onComments}
						style={styles.androidField}
					>
						<MessageSquare color={colors.label} size={22} strokeWidth={2} />
						<Text style={[styles.androidFieldLabel, { color: colors.label }]}>
							{`Comments · ${commentCount}`}
						</Text>
					</Pressable>
				)}
				<Pressable
					accessibilityLabel={`${tabCount} open tabs`}
					android_ripple={{ borderless: true, color: colors.hover }}
					onPress={onTabs}
					style={styles.androidTabs}
				>
					<TabsCount color={colors.secondaryLabel} count={tabCount} />
				</Pressable>
			</View>
			<Pressable
				accessibilityLabel={commentCount === null ? "New note" : "Quick finder"}
				android_ripple={{ color: colors.hover }}
				onPress={commentCount === null ? onNewNote : onFind}
				style={[styles.fab, { backgroundColor: colors.accentSubtle }]}
			>
				{commentCount === null ? (
					<SquarePen color={colors.tint} size={24} strokeWidth={2} />
				) : (
					<FileSearch color={colors.tint} size={24} strokeWidth={2} />
				)}
			</Pressable>
		</View>
	)
}

const styles = StyleSheet.create({
	androidField: {
		alignItems: "center",
		borderRadius: 999,
		flex: 1,
		flexDirection: "row",
		gap: 10,
		height: 48,
		overflow: "hidden",
		paddingHorizontal: 14,
	},
	androidFieldLabel: {
		flex: 1,
		fontSize: 16,
		letterSpacing: 0.5,
		lineHeight: 24,
	},
	androidPill: {
		alignItems: "center",
		borderRadius: 999,
		flex: 1,
		flexDirection: "row",
		gap: 4,
		height: 64,
		paddingHorizontal: 8,
	},
	androidRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		paddingHorizontal: 16,
	},
	androidTabs: {
		alignItems: "center",
		height: 48,
		justifyContent: "center",
		width: 48,
	},
	area: {
		height: FLOATING_TOOLBAR_HEIGHT,
		justifyContent: "flex-start",
		overflow: "hidden",
		paddingTop: 8,
	},
	fab: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 20,
		height: 64,
		justifyContent: "center",
		overflow: "hidden",
		width: 64,
	},
	flex: {
		flex: 1,
		minWidth: 0,
	},
	full: {
		width: "100%",
	},
	iosRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
		paddingHorizontal: 16,
	},
	mini: {
		alignItems: "center",
		borderRadius: 999,
		flexDirection: "row",
		gap: 6,
		height: 32,
		justifyContent: "center",
		paddingHorizontal: 12,
		width: 150,
	},
	miniLabel: {
		flexShrink: 1,
		fontSize: 13,
		fontWeight: "600",
		lineHeight: 16,
	},
	miniWrap: {
		alignItems: "center",
		bottom: 22,
		left: 0,
		position: "absolute",
		right: 0,
	},
	pill: {
		alignItems: "center",
		borderRadius: 999,
		flexDirection: "row",
		gap: 8,
		height: 52,
		paddingHorizontal: 18,
	},
	pillCenter: {
		justifyContent: "center",
	},
	pillLabel: {
		flexShrink: 1,
		fontSize: 17,
		lineHeight: 22,
	},
	square: {
		alignItems: "center",
		borderRadius: 999,
		height: 52,
		justifyContent: "center",
		width: 52,
	},
	tabsCount: {
		alignItems: "center",
		borderRadius: 7,
		borderWidth: 2,
		height: 24,
		justifyContent: "center",
		minWidth: 24,
		paddingHorizontal: 4,
	},
	tabsCountLabel: {
		fontSize: 13,
		fontWeight: "700",
		lineHeight: 16,
	},
})
