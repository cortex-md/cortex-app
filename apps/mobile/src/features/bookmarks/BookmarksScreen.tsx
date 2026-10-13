import {
	type BookmarkEntry,
	getErrorMessage,
	getNoteTitle,
	getParentPath,
	resolveBookmarkPath,
	useBookmarksStore,
	useEditorStore,
	useVaultStore,
} from "@cortex/core"
import { Stack } from "expo-router"
import {
	ArrowDown,
	ArrowUp,
	Bookmark,
	CircleMinus,
	X,
} from "lucide-react-native"
import { useMemo, useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedFooter, GroupedList, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { SearchField } from "@/components/ui/SearchField"
import { toast } from "@/features/feedback/useToast"
import { openNote, presentSheet } from "@/features/navigation/routes"
import { SidebarToggleButton } from "@/features/sidebar/SidebarToggleButton"
import { useMobileSidebar } from "@/features/sidebar/useMobileSidebar"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"

interface BookmarkRowModel {
	bookmark: BookmarkEntry
	index: number
	filePath: string
	title: string
	folder: string
	missing: boolean
	current: boolean
}

function reportFailure(error: unknown): void {
	toast(getErrorMessage(error))
}

function SmallIconButton({
	Icon,
	accessibilityLabel,
	color,
	disabled = false,
	onPress,
}: {
	Icon: typeof X
	accessibilityLabel: string
	color: string
	disabled?: boolean
	onPress: () => void
}) {
	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			disabled={disabled}
			hitSlop={6}
			onPress={onPress}
			style={({ pressed }) => [
				styles.iconButton,
				{ opacity: disabled ? 0.3 : pressed ? 0.6 : 1 },
			]}
		>
			<Icon color={color} size={IS_IOS ? 20 : 24} strokeWidth={2.2} />
		</Pressable>
	)
}

function TextButton({
	color,
	filled,
	label,
	onPress,
}: {
	color: string
	filled?: string
	label: string
	onPress: () => void
}) {
	return (
		<Pressable
			accessibilityRole="button"
			hitSlop={4}
			onPress={onPress}
			style={({ pressed }) => [
				styles.textButton,
				filled ? { backgroundColor: filled } : null,
				{ opacity: pressed ? 0.6 : 1 },
			]}
		>
			<Text style={[styles.textButtonLabel, { color }]}>{label}</Text>
		</Pressable>
	)
}

function MissingBookmarkActions({
	colors,
	onRemove,
	row,
}: {
	colors: MobileColors
	onRemove: () => void
	row: BookmarkRowModel
}) {
	return (
		<>
			<TextButton
				color={IS_IOS ? colors.label : colors.tint}
				filled={IS_IOS ? colors.fill : undefined}
				label="Find note"
				onPress={() =>
					presentSheet("quick-finder", { query: row.title, relinkBookmark: row.filePath })
				}
			/>
			{IS_IOS ? (
				<TextButton color={colors.destructiveText} label="Remove" onPress={onRemove} />
			) : (
				<SmallIconButton
					accessibilityLabel="Remove"
					color={colors.secondaryLabel}
					Icon={X}
					onPress={onRemove}
				/>
			)}
		</>
	)
}

function BookmarkRow({
	canMoveDown,
	canMoveUp,
	colors,
	editing,
	onMove,
	onRemove,
	row,
}: {
	canMoveDown: boolean
	canMoveUp: boolean
	colors: MobileColors
	editing: boolean
	onMove: (offset: number) => void
	onRemove: () => void
	row: BookmarkRowModel
}) {
	const body = (
		<View style={styles.rowBody}>
			<Text
				numberOfLines={1}
				style={[styles.rowTitle, { color: row.missing ? colors.secondaryLabel : colors.label }]}
			>
				{row.title}
			</Text>
			<Text
				numberOfLines={1}
				style={[styles.rowSubtitle, { color: row.missing ? colors.warningText : colors.secondaryLabel }]}
			>
				{row.missing ? "Moved or deleted" : row.folder || "Vault root"}
			</Text>
		</View>
	)

	return (
		<View style={[styles.row, { minHeight: IS_IOS ? 56 : 72 }]}>
			{editing && IS_IOS ? (
				<SmallIconButton
					accessibilityLabel={`Remove bookmark ${row.title}`}
					color={colors.destructive}
					Icon={CircleMinus}
					onPress={onRemove}
				/>
			) : null}
			<Bookmark
				color={row.missing ? colors.tertiaryLabel : colors.tint}
				fill={!IS_IOS && !row.missing ? colors.tint : "transparent"}
				size={IS_IOS ? 20 : 24}
				strokeWidth={2}
			/>
			{row.missing || editing ? (
				body
			) : (
				<Pressable
					accessibilityRole="button"
					onPress={() => openNote(row.filePath)}
					style={({ pressed }) => [styles.rowPress, { opacity: pressed ? 0.6 : 1 }]}
				>
					{body}
					{row.current ? <Badge label="Open" tint /> : null}
				</Pressable>
			)}
			{row.missing && !editing ? (
				<MissingBookmarkActions colors={colors} onRemove={onRemove} row={row} />
			) : null}
			{editing ? (
				<View style={styles.reorder}>
					<SmallIconButton
						accessibilityLabel={`Move ${row.title} up`}
						color={colors.secondaryLabel}
						disabled={!canMoveUp}
						Icon={ArrowUp}
						onPress={() => onMove(-1)}
					/>
					<SmallIconButton
						accessibilityLabel={`Move ${row.title} down`}
						color={colors.secondaryLabel}
						disabled={!canMoveDown}
						Icon={ArrowDown}
						onPress={() => onMove(1)}
					/>
				</View>
			) : null}
			{editing && !IS_IOS ? (
				<SmallIconButton
					accessibilityLabel={`Remove bookmark ${row.title}`}
					color={colors.secondaryLabel}
					Icon={X}
					onPress={onRemove}
				/>
			) : null}
		</View>
	)
}

function BookmarksHeader({
	canEdit,
	editing,
	onToggleEditing,
}: {
	canEdit: boolean
	editing: boolean
	onToggleEditing: () => void
}) {
	const { colors } = useMobileColors()
	const { openSidebar } = useMobileSidebar()
	const editLabel = editing ? "Done" : "Edit"
	if (!IS_IOS) {
		return (
			<Stack.Screen
				options={{
					headerLeft: () => <SidebarToggleButton />,
					headerRight: () => (
						<TextButton color={colors.tint} label={editLabel} onPress={onToggleEditing} />
					),
				}}
			/>
		)
	}
	return (
		<>
			<Stack.Toolbar placement="left">
				<Stack.Toolbar.Button
					accessibilityLabel="Show sidebar"
					icon="sidebar.left"
					onPress={openSidebar}
				/>
			</Stack.Toolbar>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Button
					disabled={!canEdit}
					onPress={onToggleEditing}
					variant={editing ? "done" : "plain"}
				>
					{editLabel}
				</Stack.Toolbar.Button>
			</Stack.Toolbar>
		</>
	)
}

export function BookmarksScreen() {
	const { colors } = useMobileColors()
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const files = useVaultStore((state) => state.files)
	const bookmarks = useBookmarksStore((state) => state.bookmarks)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const [editing, setEditing] = useState(false)
	const [filter, setFilter] = useState("")

	const filePaths = useMemo(() => new Set(files.map((file) => file.path)), [files])
	const rows = useMemo<BookmarkRowModel[]>(() => {
		if (!vaultPath) return []
		return bookmarks.map((bookmark, index) => {
			const filePath = resolveBookmarkPath(vaultPath, bookmark.path)
			return {
				bookmark,
				index,
				filePath,
				title: getNoteTitle(bookmark.path),
				folder: getParentPath(bookmark.path),
				missing: !filePaths.has(filePath),
				current: filePath === activeFilePath,
			}
		})
	}, [activeFilePath, bookmarks, filePaths, vaultPath])

	const needle = filter.trim().toLowerCase()
	const visibleRows = needle
		? rows.filter((row) => row.title.toLowerCase().includes(needle))
		: rows

	const removeRow = (row: BookmarkRowModel) => {
		if (!vaultPath) return
		void useBookmarksStore.getState().removeBookmark(vaultPath, row.filePath).catch(reportFailure)
	}

	const moveRow = (row: BookmarkRowModel, offset: number) => {
		if (!vaultPath) return
		const target = row.index + offset
		if (target < 0 || target >= rows.length) return
		void useBookmarksStore
			.getState()
			.reorderBookmark(vaultPath, row.filePath, target)
			.catch(reportFailure)
	}

	return (
		<>
			<ScrollView
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				style={{ backgroundColor: colors.groupedBackground }}
			>
				<View style={styles.filter}>
					<SearchField
						accessibilityLabel="Filter bookmarks"
						onChangeText={setFilter}
						onClear={() => setFilter("")}
						placeholder="Filter bookmarks"
						value={filter}
					/>
				</View>
				{rows.length === 0 ? (
					<EmptyState
						description={`Bookmark the open note from its ${IS_IOS ? "⋯" : "⋮"} menu.`}
						Icon={Bookmark}
						title="No bookmarks"
					/>
				) : (
					<>
						<GroupedSectionHeader
							trailing={
								editing ? (
									<Text style={[styles.hint, { color: colors.secondaryLabel }]}>
										Use the arrows to reorder
									</Text>
								) : undefined
							}
						>
							{`${visibleRows.length} ${visibleRows.length === 1 ? "bookmark" : "bookmarks"}`}
						</GroupedSectionHeader>
						{visibleRows.length > 0 ? (
							<GroupedList>
								{visibleRows.map((row) => (
									<BookmarkRow
										canMoveDown={!needle && row.index < rows.length - 1}
										canMoveUp={!needle && row.index > 0}
										colors={colors}
										editing={editing}
										key={row.bookmark.path}
										onMove={(offset) => moveRow(row, offset)}
										onRemove={() => removeRow(row)}
										row={row}
									/>
								))}
							</GroupedList>
						) : (
							<EmptyState title={`No bookmarks match “${filter.trim()}”`} />
						)}
						<GroupedFooter>{`Bookmark the open note from its ${IS_IOS ? "⋯" : "⋮"} menu.`}</GroupedFooter>
					</>
				)}
			</ScrollView>
			<BookmarksHeader
				canEdit={rows.length > 0}
				editing={editing}
				onToggleEditing={() => setEditing((current) => !current)}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 32,
	},
	filter: {
		paddingBottom: 4,
		paddingTop: 4,
	},
	hint: {
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: 18,
	},
	iconButton: {
		alignItems: "center",
		height: IS_IOS ? 32 : 40,
		justifyContent: "center",
		width: IS_IOS ? 32 : 40,
	},
	reorder: {
		flexDirection: "row",
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: IS_IOS ? 10 : 16,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	rowBody: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	rowPress: {
		alignItems: "center",
		flex: 1,
		flexDirection: "row",
		gap: 8,
		minWidth: 0,
	},
	rowSubtitle: {
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: IS_IOS ? 18 : 20,
	},
	rowTitle: {
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: IS_IOS ? 22 : 24,
	},
	textButton: {
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	textButtonLabel: {
		fontSize: IS_IOS ? 15 : 14,
		fontWeight: "500",
		lineHeight: 20,
	},
})
