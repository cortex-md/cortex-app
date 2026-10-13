import type { FileEntry } from "@cortex/platform"
import type { Href } from "expo-router"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import type { MenuGroup } from "@/components/ui/menuTypes"
import { Symbol } from "@/components/ui/Symbol"
import { EntryContextMenu } from "@/features/file-explorer/EntryContextMenu"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const INDENT = 18
const SIDEBAR_ROW_HEIGHT = IS_IOS ? 44 : 48
const CHEVRON_SIZE = 12
const ROW_GAP = 8

export function SidebarTreeRow({
	active,
	depth,
	entry,
	expanded,
	menuGroups,
	onOpenNote,
	onToggleFolder,
	title,
}: {
	active: boolean
	depth: number
	entry: FileEntry
	expanded: boolean
	menuGroups: MenuGroup[]
	onOpenNote: (filePath: string) => void
	onToggleFolder: (folderPath: string) => void
	title: string
}) {
	const { colors } = useMobileColors()
	const guides = Array.from({ length: depth }, (_, level) => 12 + level * INDENT + 6)
	const href = (
		entry.isDir
			? { params: { path: entry.path }, pathname: "/folder" }
			: { params: { filePath: entry.path }, pathname: "/note" }
	) as Href

	return (
		<EntryContextMenu
			groups={menuGroups}
			href={href}
			onPress={() => {
				if (entry.isDir) onToggleFolder(entry.path)
				else onOpenNote(entry.path)
			}}
		>
			{(trigger) => (
				<Pressable
					accessibilityRole={entry.isDir ? "button" : "link"}
					accessibilityState={entry.isDir ? { expanded } : { selected: active }}
					android_ripple={{ color: colors.hover }}
					onLongPress={trigger.onLongPress}
					onPress={trigger.onPress}
					style={({ pressed }) => [
						styles.row,
						{
							backgroundColor: active
								? colors.accentSubtle
								: pressed && IS_IOS
									? colors.hover
									: "transparent",
							paddingLeft: 12 + depth * INDENT + (entry.isDir ? 0 : CHEVRON_SIZE + ROW_GAP),
						},
					]}
				>
					{guides.map((left) => (
						<View
							key={left}
							pointerEvents="none"
							style={[styles.guide, { backgroundColor: colors.sidebarGuide, left }]}
						/>
					))}
					{entry.isDir ? (
						<Symbol
							color={colors.tertiaryLabel}
							name={
								expanded
									? { sf: "chevron.down", md: "keyboard_arrow_down" }
									: { sf: "chevron.right", md: "keyboard_arrow_right" }
							}
							size={CHEVRON_SIZE}
						/>
					) : null}
					<Symbol
						color={active ? colors.tint : entry.isDir ? colors.tint : colors.secondaryLabel}
						name={
							entry.isDir ? { sf: "folder", md: "folder" } : { sf: "doc.text", md: "description" }
						}
						size={IS_IOS ? 18 : 20}
					/>
					<Text
						numberOfLines={1}
						style={[
							styles.title,
							{
								color: active ? colors.tint : colors.label,
								fontWeight: active ? "600" : IS_IOS ? "400" : "500",
							},
						]}
					>
						{title}
					</Text>
				</Pressable>
			)}
		</EntryContextMenu>
	)
}

const styles = StyleSheet.create({
	guide: {
		bottom: 0,
		position: "absolute",
		top: 0,
		width: StyleSheet.hairlineWidth,
	},
	row: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 10 : 999,
		flexDirection: "row",
		gap: ROW_GAP,
		height: SIDEBAR_ROW_HEIGHT,
		overflow: "hidden",
		paddingRight: 12,
	},
	title: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 14,
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: IS_IOS ? 22 : 20,
	},
})
