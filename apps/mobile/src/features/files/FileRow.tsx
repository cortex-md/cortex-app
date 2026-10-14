import type { Href } from "expo-router"
import { useRef, useState } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"
import ReanimatedSwipeable, {
	type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable"

import type { MenuGroup } from "@/components/ui/menuTypes"
import { SymbolIcon, type SymbolName } from "@/components/ui/Symbol"
import { EntryContextMenu } from "@/features/file-explorer/EntryContextMenu"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"
const ACTION_WIDTH = IS_IOS ? 80 : 76

function usePressHighlight() {
	const [pressed, setPressed] = useState(false)
	return {
		onPressIn: () => setPressed(true),
		onPressOut: () => setPressed(false),
		pressed,
	}
}

export function FolderRow({
	href,
	menuGroups,
	onPress,
	title,
	value,
}: {
	href: Href
	menuGroups: MenuGroup[]
	onPress: () => void
	title: string
	value?: string
}) {
	const { colors } = useMobileColors()
	const press = usePressHighlight()
	return (
		<EntryContextMenu groups={menuGroups} header={title} href={href} onPress={onPress}>
			{(trigger) => (
				<Pressable
					accessibilityRole="button"
					android_ripple={{ color: colors.hover }}
					onLongPress={trigger.onLongPress}
					onPress={trigger.onPress}
					onPressIn={press.onPressIn}
					onPressOut={press.onPressOut}
					style={StyleSheet.flatten([
						styles.row,
						{ backgroundColor: press.pressed && IS_IOS ? colors.hover : colors.cell },
					])}
				>
					<SymbolIcon
						color={colors.tint}
						name={{ sf: "folder", md: "folder" }}
						size={IS_IOS ? 22 : 24}
					/>
					<Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
						{title}
					</Text>
					{value ? (
						<Text style={[styles.value, { color: colors.secondaryLabel }]}>{value}</Text>
					) : null}
					<SymbolIcon
						color={colors.tertiaryLabel}
						name={{ sf: "chevron.right", md: "chevron_right" }}
						size={IS_IOS ? 13 : 24}
					/>
				</Pressable>
			)}
		</EntryContextMenu>
	)
}

function SwipeAction({
	background,
	foreground,
	icon,
	label,
	onPress,
}: {
	background: string
	foreground: string
	icon: SymbolName
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
			<SymbolIcon color={foreground} name={icon} size={22} />
			<Text style={[styles.actionLabel, { color: foreground }]}>{label}</Text>
		</Pressable>
	)
}

export function NoteRow({
	bookmarked,
	detail,
	href,
	icon = { sf: "doc.text", md: "description" },
	menuGroups,
	onBookmark,
	onDelete,
	onPress,
	title,
}: {
	bookmarked: boolean
	detail?: string
	href: Href
	icon?: SymbolName
	menuGroups: MenuGroup[]
	onBookmark: () => void
	onDelete: () => void
	onPress: () => void
	title: string
}) {
	const { colors } = useMobileColors()
	const press = usePressHighlight()
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
						background={colors.tintFill}
						foreground={colors.onTint}
						icon={
							bookmarked
								? { sf: "bookmark.slash", md: "bookmark_remove" }
								: { sf: "bookmark", md: "bookmark" }
						}
						label={bookmarked ? "Unbookmark" : "Bookmark"}
						onPress={() => runAction(onBookmark)}
					/>
					<SwipeAction
						background={colors.destructive}
						foreground={colors.onDestructive}
						icon={{ sf: "trash", md: "delete" }}
						label="Delete"
						onPress={() => runAction(onDelete)}
					/>
				</View>
			)}
			rightThreshold={40}
		>
			<EntryContextMenu groups={menuGroups} header={title} href={href} onPress={onPress}>
				{(trigger) => (
					<Pressable
						accessibilityRole="button"
						android_ripple={{ color: colors.hover }}
						onLongPress={trigger.onLongPress}
						onPress={trigger.onPress}
						onPressIn={press.onPressIn}
						onPressOut={press.onPressOut}
						style={StyleSheet.flatten([
							styles.row,
							styles.noteRow,
							{ backgroundColor: press.pressed && IS_IOS ? colors.hover : colors.cell },
						])}
					>
						<SymbolIcon
							color={colors.secondaryLabel}
							name={{ sf: "doc.text", md: "description" }}
							size={IS_IOS ? 22 : 24}
						/>
						<View style={styles.body}>
							<Text
								numberOfLines={1}
								style={[styles.title, styles.noteTitle, { color: colors.label }]}
							>
								{title}
							</Text>
							{detail ? (
								<Text numberOfLines={1} style={[styles.detail, { color: colors.secondaryLabel }]}>
									{detail}
								</Text>
							) : null}
						</View>
						{bookmarked ? (
							<SymbolIcon
								color={colors.tint}
								name={{ sf: "bookmark.fill", md: "bookmark" }}
								size={16}
							/>
						) : null}
					</Pressable>
				)}
			</EntryContextMenu>
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
		minHeight: IS_IOS ? 60 : 72,
	},
	noteTitle: {
		fontWeight: IS_IOS ? "600" : "500",
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: IS_IOS ? 12 : 16,
		minHeight: IS_IOS ? 48 : 56,
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
