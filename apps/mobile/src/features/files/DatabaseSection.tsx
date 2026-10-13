import { retainDatabase } from "@cortex/core"
import { useEffect } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { StatusPill, statusToneFromLabel } from "@/components/ui/StatusPill"
import { SymbolIcon } from "@/components/ui/Symbol"
import { DATABASE_PREVIEW_ROWS, type FilesDatabaseItem } from "@/features/files/useFilesScreenModel"
import { openDatabase, openNote } from "@/features/navigation/routes"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"
const CHILD_INSET = IS_IOS ? 58 : 72

function rowStatusLabel(meta: Record<string, unknown>): string {
	const status = meta.status
	if (typeof status === "string") return status
	if (Array.isArray(status) && typeof status[0] === "string") return status[0]
	return ""
}

export function DatabaseItemRows({
	expanded,
	item,
	onToggle,
}: {
	expanded: boolean
	item: FilesDatabaseItem
	onToggle: () => void
}) {
	const { colors } = useMobileColors()
	const folderPath = item.entry.folderPath
	useEffect(() => retainDatabase(folderPath), [folderPath])
	const shown = expanded ? item.rows.slice(0, DATABASE_PREVIEW_ROWS) : []
	const remaining = item.noteCount - shown.length
	const noteLabel = `${item.noteCount} ${item.noteCount === 1 ? "note" : "notes"}`

	return (
		<View style={{ backgroundColor: colors.cell }}>
			<View style={styles.row}>
				<Pressable
					accessibilityRole="button"
					android_ripple={{ color: colors.hover }}
					onPress={() => openDatabase(item.entry.folderPath)}
					style={({ pressed }) => [styles.main, { opacity: pressed ? 0.6 : 1 }]}
				>
					<View style={[styles.tile, { backgroundColor: colors.accentSubtle }]}>
						<SymbolIcon
							color={colors.tint}
							name={{ sf: "tablecells", md: "table" }}
							size={IS_IOS ? 20 : 22}
						/>
					</View>
					<View style={styles.body}>
						<Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
							{item.entry.name}
						</Text>
						<Text numberOfLines={1} style={[styles.detail, { color: colors.secondaryLabel }]}>
							{item.loading ? "Loading…" : noteLabel}
						</Text>
					</View>
				</Pressable>
				<Pressable
					accessibilityLabel={`Show notes in ${item.entry.name}`}
					accessibilityRole="button"
					accessibilityState={{ expanded }}
					hitSlop={8}
					onPress={() => {
						triggerSelectionHaptic()
						onToggle()
					}}
					style={styles.chevronButton}
				>
					<SymbolIcon
						color={colors.tertiaryLabel}
						name={
							expanded
								? { sf: "chevron.down", md: "keyboard_arrow_down" }
								: { sf: "chevron.right", md: "keyboard_arrow_right" }
						}
						size={IS_IOS ? 14 : 24}
					/>
				</Pressable>
			</View>
			{shown.map((row) => {
				const status = rowStatusLabel(row.meta)
				return (
					<Pressable
						accessibilityRole="button"
						android_ripple={{ color: colors.hover }}
						key={row.path}
						onPress={() => openNote(row.path)}
						style={({ pressed }) => [
							styles.child,
							{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
						]}
					>
						<StatusPill compact label={status || "Untitled"} tone={statusToneFromLabel(status)} />
						<Text numberOfLines={1} style={[styles.childTitle, { color: colors.label }]}>
							{row.title}
						</Text>
					</Pressable>
				)
			})}
			{expanded && remaining > 0 ? (
				<Pressable
					accessibilityRole="button"
					android_ripple={{ color: colors.hover }}
					onPress={() => openDatabase(item.entry.folderPath)}
					style={({ pressed }) => [styles.child, { opacity: pressed ? 0.6 : 1 }]}
				>
					<Text numberOfLines={1} style={[styles.childTitle, { color: colors.tint }]}>
						{`${remaining} more`}
					</Text>
				</Pressable>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	body: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	chevronButton: {
		alignItems: "center",
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	child: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: IS_IOS ? 44 : 48,
		paddingLeft: CHILD_INSET,
		paddingRight: 16,
	},
	childTitle: {
		flex: 1,
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
	},
	detail: {
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: IS_IOS ? 18 : 20,
	},
	main: {
		alignItems: "center",
		flex: 1,
		flexDirection: "row",
		gap: IS_IOS ? 12 : 16,
		minWidth: 0,
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		minHeight: IS_IOS ? 64 : 72,
		paddingLeft: 16,
		paddingRight: 6,
		paddingVertical: 8,
	},
	tile: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 10 : 12,
		height: IS_IOS ? 36 : 40,
		justifyContent: "center",
		width: IS_IOS ? 36 : 40,
	},
	title: {
		fontSize: IS_IOS ? 17 : 16,
		fontWeight: IS_IOS ? "600" : "500",
		lineHeight: IS_IOS ? 22 : 24,
	},
})
