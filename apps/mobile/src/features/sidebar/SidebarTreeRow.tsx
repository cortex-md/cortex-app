import type { FileEntry } from "@cortex/platform"
import { ChevronRight } from "lucide-react-native"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const INDENT = 18
const ROW_HEIGHT = Platform.OS === "ios" ? 44 : 48
const NOTE_INSET = Platform.OS === "ios" ? 22 : 24

export function SidebarTreeRow({
	active,
	depth,
	entry,
	expanded,
	onLongPress,
	onOpenNote,
	onToggleFolder,
	title,
}: {
	active: boolean
	depth: number
	entry: FileEntry
	expanded: boolean
	onLongPress: (entry: FileEntry) => void
	onOpenNote: (filePath: string) => void
	onToggleFolder: (folderPath: string) => void
	title: string
}) {
	const { colors } = useMobileColors()
	const guides = Array.from({ length: depth }, (_, level) => 12 + level * INDENT + 8)

	return (
		<Pressable
			accessibilityRole={entry.isDir ? "button" : "link"}
			accessibilityState={{ selected: active }}
			onLongPress={() => onLongPress(entry)}
			onPress={() => {
				if (entry.isDir) onToggleFolder(entry.path)
				else onOpenNote(entry.path)
			}}
			style={({ pressed }) => [
				styles.row,
				{
					backgroundColor: active ? colors.accentSubtle : pressed ? colors.hover : "transparent",
					paddingLeft: 12 + depth * INDENT + (entry.isDir ? 0 : NOTE_INSET),
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
				<ChevronRight
					color={colors.tertiaryLabel}
					size={16}
					strokeWidth={2.6}
					style={expanded ? styles.chevronOpen : undefined}
				/>
			) : null}
			<Text
				numberOfLines={1}
				style={[
					styles.title,
					{
						color: active ? colors.tint : colors.label,
						fontWeight: active ? (Platform.OS === "ios" ? "600" : "700") : "400",
					},
				]}
			>
				{title}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	chevronOpen: {
		transform: [{ rotate: "90deg" }],
	},
	guide: {
		bottom: 0,
		position: "absolute",
		top: 0,
		width: 1,
	},
	row: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: Platform.OS === "ios" ? 12 : 999,
		flexDirection: "row",
		gap: 6,
		height: ROW_HEIGHT,
		paddingRight: 12,
	},
	title: {
		flex: 1,
		fontSize: Platform.OS === "ios" ? 17 : 14,
		letterSpacing: Platform.OS === "ios" ? 0 : 0.1,
		lineHeight: Platform.OS === "ios" ? 22 : 20,
	},
})
