import type { FileEntry } from "@cortex/platform"
import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react-native"
import { Pressable, StyleSheet, Text, View } from "react-native"

import type { MobileColors, MobileIconColors } from "@/theme/colors"

export function SidebarFileItem({
	active,
	colors,
	depth,
	entry,
	expanded,
	iconColors,
	onLongPress,
	onOpenNote,
	onToggleFolder,
	title,
}: {
	active: boolean
	colors: MobileColors
	depth: number
	entry: FileEntry
	expanded: boolean
	iconColors: MobileIconColors
	onLongPress: (entry: FileEntry) => void
	onOpenNote: (filePath: string) => void
	onToggleFolder: (folderPath: string) => void
	title: string
}) {
	const Icon = entry.isDir ? (expanded ? FolderOpen : Folder) : FileText

	return (
		<Pressable
			onLongPress={() => onLongPress(entry)}
			onPress={() => {
				if (entry.isDir) onToggleFolder(entry.path)
				else onOpenNote(entry.path)
			}}
			style={({ pressed }) => [
				styles.fileRow,
				{
					backgroundColor: active ? colors.secondaryBackground : "transparent",
					marginLeft: depth * 15,
					opacity: pressed ? 0.58 : 1,
				},
			]}
		>
			{entry.isDir ? (
				<ChevronRight
					color={iconColors.secondary}
					size={15}
					style={[styles.disclosure, expanded ? styles.disclosureOpen : null]}
				/>
			) : (
				<View style={styles.disclosurePlaceholder} />
			)}
			<Icon color={active ? iconColors.tint : iconColors.secondary} size={18} strokeWidth={2.15} />
			<Text numberOfLines={1} style={[styles.fileRowText, { color: colors.label }]}>
				{title}
			</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	disclosure: {
		transform: [{ rotate: "0deg" }],
	},
	disclosureOpen: {
		transform: [{ rotate: "90deg" }],
	},
	disclosurePlaceholder: {
		width: 15,
	},
	fileRow: {
		alignItems: "center",
		borderRadius: 8,
		flexDirection: "row",
		gap: 8,
		minHeight: 36,
		paddingHorizontal: 10,
	},
	fileRowText: {
		flex: 1,
		fontSize: 15,
		fontWeight: "500",
		letterSpacing: 0,
		lineHeight: 20,
		minWidth: 0,
	},
})
