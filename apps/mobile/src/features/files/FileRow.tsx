import { Bookmark, ChevronRight, FileText, Folder, Trash2 } from "lucide-react-native"
import { useRef } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"
import ReanimatedSwipeable, {
	type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable"

import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"
const ACTION_WIDTH = IS_IOS ? 80 : 76

export function FolderRow({
	onLongPress,
	onPress,
	title,
	value,
}: {
	onLongPress?: () => void
	onPress: () => void
	title: string
	value?: string
}) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			accessibilityRole="button"
			android_ripple={{ color: colors.hover }}
			onLongPress={onLongPress}
			onPress={onPress}
			style={({ pressed }) => [
				styles.row,
				{ backgroundColor: pressed && IS_IOS ? colors.hover : colors.cell },
			]}
		>
			<Folder color={colors.secondaryLabel} size={IS_IOS ? 22 : 24} strokeWidth={2} />
			<Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
				{title}
			</Text>
			{value ? <Text style={[styles.value, { color: colors.secondaryLabel }]}>{value}</Text> : null}
			<ChevronRight color={colors.tertiaryLabel} size={IS_IOS ? 14 : 24} strokeWidth={2.4} />
		</Pressable>
	)
}

function SwipeAction({
	Icon,
	background,
	foreground,
	label,
	onPress,
}: {
	Icon: typeof Bookmark
	background: string
	foreground: string
	label: string
	onPress: () => void
}) {
	return (
		<Pressable
			accessibilityLabel={label}
			accessibilityRole="button"
			onPress={onPress}
			style={[styles.action, { backgroundColor: background }]}
		>
			<Icon color={foreground} size={22} strokeWidth={2.2} />
			<Text style={[styles.actionLabel, { color: foreground }]}>{label}</Text>
		</Pressable>
	)
}

export function NoteRow({
	bookmarked,
	detail,
	onBookmark,
	onDelete,
	onLongPress,
	onPress,
	title,
}: {
	bookmarked: boolean
	detail?: string
	onBookmark: () => void
	onDelete: () => void
	onLongPress?: () => void
	onPress: () => void
	title: string
}) {
	const { colors } = useMobileColors()
	const swipeableRef = useRef<SwipeableMethods>(null)

	function runAction(action: () => void) {
		swipeableRef.current?.close()
		triggerSelectionHaptic()
		action()
	}

	return (
		<ReanimatedSwipeable
			friction={2}
			overshootRight={false}
			ref={swipeableRef}
			renderRightActions={() => (
				<View style={styles.actions}>
					<SwipeAction
						Icon={Bookmark}
						background={colors.tintFill}
						foreground={colors.onTint}
						label={bookmarked ? "Unbookmark" : "Bookmark"}
						onPress={() => runAction(onBookmark)}
					/>
					<SwipeAction
						Icon={Trash2}
						background={colors.destructive}
						foreground={colors.onDestructive}
						label="Delete"
						onPress={() => runAction(onDelete)}
					/>
				</View>
			)}
			rightThreshold={40}
		>
			<Pressable
				accessibilityRole="button"
				android_ripple={{ color: colors.hover }}
				onLongPress={onLongPress}
				onPress={onPress}
				style={({ pressed }) => [
					styles.row,
					styles.noteRow,
					{ backgroundColor: pressed && IS_IOS ? colors.hover : colors.cell },
				]}
			>
				{IS_IOS ? null : (
					<FileText color={colors.secondaryLabel} size={24} strokeWidth={2} />
				)}
				<View style={styles.body}>
					<Text numberOfLines={1} style={[styles.title, styles.noteTitle, { color: colors.label }]}>
						{title}
					</Text>
					{detail ? (
						<Text numberOfLines={1} style={[styles.detail, { color: colors.secondaryLabel }]}>
							{detail}
						</Text>
					) : null}
				</View>
				{bookmarked ? (
					<Bookmark color={colors.tint} fill={colors.tint} size={18} strokeWidth={2} />
				) : null}
			</Pressable>
		</ReanimatedSwipeable>
	)
}

const styles = StyleSheet.create({
	action: {
		alignItems: "center",
		gap: 4,
		justifyContent: "center",
		width: ACTION_WIDTH,
	},
	actionLabel: {
		fontSize: 12,
		fontWeight: "600",
		lineHeight: 16,
	},
	actions: {
		flexDirection: "row",
	},
	body: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	detail: {
		fontSize: IS_IOS ? 13 : 14,
		letterSpacing: IS_IOS ? 0 : 0.25,
		lineHeight: IS_IOS ? 18 : 20,
	},
	noteRow: {
		minHeight: IS_IOS ? 70 : 72,
	},
	noteTitle: {
		fontWeight: IS_IOS ? "600" : "500",
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: IS_IOS ? 12 : 16,
		minHeight: IS_IOS ? 52 : 56,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	title: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 16,
		letterSpacing: IS_IOS ? 0 : 0.5,
		lineHeight: IS_IOS ? 22 : 24,
	},
	value: {
		fontSize: IS_IOS ? 17 : 14,
		lineHeight: IS_IOS ? 22 : 20,
	},
})
