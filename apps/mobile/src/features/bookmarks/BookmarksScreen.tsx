import {
	getErrorMessage,
	getNoteTitle,
	getParentPath,
	resolveBookmarkPath,
	useBookmarksStore,
	useVaultStore,
} from "@cortex/core"
import { type Href, Stack } from "expo-router"
import { useMemo, useState } from "react"
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { Symbol, type SymbolName } from "@/components/ui/Symbol"
import { toast } from "@/features/feedback/useToast"
import { openNote, presentSheet } from "@/features/navigation/routes"
import { ListCell, ListSectionHeader, listCellStyles } from "@/features/search/ListCell"
import { RowContextMenu, type RowMenuEntry } from "@/features/search/RowContextMenu"
import { SidebarToggleButton } from "@/features/sidebar/SidebarToggleButton"
import { useMobileSidebar } from "@/features/sidebar/useMobileSidebar"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

interface BookmarkRowModel {
	key: string
	index: number
	filePath: string
	title: string
	folder: string
	missing: boolean
}

function reportFailure(error: unknown): void {
	toast(getErrorMessage(error))
}

function IconButton({
	accessibilityLabel,
	color,
	disabled = false,
	icon,
	onPress,
}: {
	accessibilityLabel: string
	color: string
	disabled?: boolean
	icon: SymbolName
	onPress: () => void
}) {
	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			disabled={disabled}
			hitSlop={6}
			onPress={onPress}
			style={({ pressed }) => [styles.iconButton, { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}
		>
			<Symbol color={color} name={icon} size={IS_IOS ? 22 : 24} />
		</Pressable>
	)
}

export function BookmarksScreen() {
	const { colors } = useMobileColors()
	const { openSidebar } = useMobileSidebar()
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const vaultName = useVaultStore((state) => state.vault?.name ?? "Vault")
	const files = useVaultStore((state) => state.files)
	const bookmarks = useBookmarksStore((state) => state.bookmarks)
	const [editing, setEditing] = useState(false)
	const [filter, setFilter] = useState("")

	const filePaths = useMemo(() => new Set(files.map((file) => file.path)), [files])
	const rows = useMemo<BookmarkRowModel[]>(() => {
		if (!vaultPath) return []
		return bookmarks.map((bookmark, index) => {
			const filePath = resolveBookmarkPath(vaultPath, bookmark.path)
			const folder = getParentPath(bookmark.path)
			return {
				key: bookmark.path,
				index,
				filePath,
				title: getNoteTitle(bookmark.path),
				folder: folder ? folder.slice(folder.lastIndexOf("/") + 1) : vaultName,
				missing: !filePaths.has(filePath),
			}
		})
	}, [bookmarks, filePaths, vaultName, vaultPath])

	const needle = filter.trim().toLowerCase()
	const visibleRows = needle ? rows.filter((row) => row.title.toLowerCase().includes(needle)) : rows
	const isEditing = editing && rows.length > 0

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

	const relink = (row: BookmarkRowModel) => {
		presentSheet("quick-finder", { query: row.title, relinkBookmark: row.filePath })
	}

	const activate = (row: BookmarkRowModel) => {
		if (row.missing) relink(row)
		else openNote(row.filePath)
	}

	const showAndroidActions = (row: BookmarkRowModel) => {
		Alert.alert(row.title, row.missing ? "This note was moved or deleted." : undefined, [
			{ style: "cancel", text: "Cancel" },
			{ onPress: () => removeRow(row), style: "destructive", text: "Remove" },
			row.missing
				? { onPress: () => relink(row), text: "Find note" }
				: { onPress: () => openNote(row.filePath), text: "Open" },
		])
	}

	const menuEntries = (row: BookmarkRowModel): RowMenuEntry[] => [
		row.missing
			? { icon: "magnifyingglass", key: "find", label: "Find note", onPress: () => relink(row) }
			: { icon: "doc.text", key: "open", label: "Open", onPress: () => openNote(row.filePath) },
		{
			destructive: true,
			icon: "bookmark.slash",
			key: "remove",
			label: "Remove bookmark",
			onPress: () => removeRow(row),
		},
	]

	const renderBody = (row: BookmarkRowModel) => (
		<>
			<Symbol
				color={row.missing ? colors.warningText : colors.tint}
				name={
					row.missing
						? { md: "warning", sf: "exclamationmark.triangle" }
						: { md: "bookmark", sf: "bookmark.fill" }
				}
				size={IS_IOS ? 20 : 24}
			/>
			<View style={listCellStyles.body}>
				<Text
					numberOfLines={1}
					style={[
						listCellStyles.title,
						{ color: row.missing ? colors.secondaryLabel : colors.label },
					]}
				>
					{row.title}
				</Text>
				<Text
					numberOfLines={1}
					style={[
						styles.subtitle,
						{ color: row.missing ? colors.warningText : colors.secondaryLabel },
					]}
				>
					{row.missing ? "Moved or deleted" : row.folder}
				</Text>
			</View>
		</>
	)

	return (
		<>
			<FlatList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				data={visibleRows}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				keyExtractor={(row) => row.key}
				ListEmptyComponent={
					rows.length === 0 ? (
						<EmptyState
							description={`Bookmark a note from its ${IS_IOS ? "⋯" : "⋮"} menu.`}
							icon={{ md: "bookmark", sf: "bookmark" }}
							title="No bookmarks"
						/>
					) : (
						<EmptyState
							icon={{ md: "search_off", sf: "magnifyingglass" }}
							title={`No bookmarks match “${filter.trim()}”`}
						/>
					)
				}
				ListHeaderComponent={
					visibleRows.length > 0 ? (
						<ListSectionHeader>
							{`${visibleRows.length} ${visibleRows.length === 1 ? "bookmark" : "bookmarks"}`}
						</ListSectionHeader>
					) : null
				}
				renderItem={({ item: row, index }) => {
					const first = index === 0
					const last = index === visibleRows.length - 1
					if (isEditing) {
						return (
							<ListCell first={first} last={last} separatorInset={IS_IOS ? 92 : 16}>
								<IconButton
									accessibilityLabel={`Remove bookmark ${row.title}`}
									color={colors.destructive}
									icon={{ md: "remove_circle", sf: "minus.circle.fill" }}
									onPress={() => removeRow(row)}
								/>
								{renderBody(row)}
								<IconButton
									accessibilityLabel={`Move ${row.title} up`}
									color={colors.secondaryLabel}
									disabled={Boolean(needle) || row.index === 0}
									icon={{ md: "arrow_upward", sf: "arrow.up" }}
									onPress={() => moveRow(row, -1)}
								/>
								<IconButton
									accessibilityLabel={`Move ${row.title} down`}
									color={colors.secondaryLabel}
									disabled={Boolean(needle) || row.index === rows.length - 1}
									icon={{ md: "arrow_downward", sf: "arrow.down" }}
									onPress={() => moveRow(row, 1)}
								/>
							</ListCell>
						)
					}
					return (
						<RowContextMenu
							entries={menuEntries(row)}
							href={{ pathname: "/note", params: { filePath: row.filePath } } as Href}
							onPress={() => activate(row)}
						>
							{(onPress) => (
								<ListCell
									first={first}
									last={last}
									onLongPress={IS_IOS ? undefined : () => showAndroidActions(row)}
									onPress={onPress}
									separatorInset={IS_IOS ? 48 : 16}
								>
									{renderBody(row)}
								</ListCell>
							)}
						</RowContextMenu>
					)
				}}
				style={{ backgroundColor: colors.groupedBackground }}
			/>
			<Stack.SearchBar
				autoCapitalize="none"
				hideWhenScrolling={false}
				onCancelButtonPress={() => setFilter("")}
				onChangeText={(event) => setFilter(event.nativeEvent.text)}
				placeholder="Filter bookmarks"
			/>
			{IS_IOS ? (
				<>
					<Stack.Toolbar placement="left">
						<Stack.Toolbar.Button
							accessibilityLabel="Open sidebar"
							icon="sidebar.left"
							onPress={openSidebar}
						/>
					</Stack.Toolbar>
					<Stack.Toolbar placement="right">
						<Stack.Toolbar.Button
							disabled={rows.length === 0}
							onPress={() => setEditing((current) => !current)}
							variant={isEditing ? "done" : "plain"}
						>
							{isEditing ? "Done" : "Edit"}
						</Stack.Toolbar.Button>
					</Stack.Toolbar>
				</>
			) : (
				<Stack.Screen
					options={{
						headerLeft: () => <SidebarToggleButton />,
						headerRight:
							rows.length > 0
								? () => (
										<HeaderIconButton
											accessibilityLabel={isEditing ? "Done" : "Edit bookmarks"}
											icon={
												isEditing ? { md: "check", sf: "checkmark" } : { md: "edit", sf: "pencil" }
											}
											onPress={() => setEditing((current) => !current)}
										/>
									)
								: undefined,
					}}
				/>
			)}
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 32,
	},
	iconButton: {
		alignItems: "center",
		height: IS_IOS ? 32 : 40,
		justifyContent: "center",
		width: IS_IOS ? 32 : 40,
	},
	subtitle: {
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: IS_IOS ? 18 : 20,
	},
})
