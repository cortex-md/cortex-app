import {
	formatRelativeTime,
	getErrorMessage,
	getFileModifiedTimes,
	getNoteTitle,
	getParentPath,
	getTagPageModel,
	type TagPageNote,
	toVaultRelativePath,
	useTagsStore,
	useVaultStore,
} from "@cortex/core"
import { type Href, router, Stack, useLocalSearchParams } from "expo-router"
import { MoreVertical, Palette, Pencil, Search } from "lucide-react-native"
import { useMemo, useState } from "react"
import {
	ActivityIndicator,
	FlatList,
	Platform,
	Pressable,
	SectionList,
	StyleSheet,
	Text,
	View,
} from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { FilterChip } from "@/components/ui/FilterChip"
import { GroupedSectionHeader } from "@/components/ui/GroupedList"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import type { MenuItem } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { TextPromptDialog } from "@/components/ui/TextPromptDialog"
import { toast } from "@/features/feedback/useToast"
import { openNote } from "@/features/navigation/routes"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import { useNoteExcerpt } from "@/features/search/noteExcerpts"
import { useEnsureVaultIndexed } from "@/features/search/vaultIndexing"
import { getTagColorOptions, resolveTagColor } from "@/features/tags/tagColors"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"

function normalizeTagParam(value: string | string[] | undefined): string {
	const raw = Array.isArray(value) ? value[0] : value
	return (raw ?? "").replace(/^#/, "").trim()
}

function getTagNameError(value: string): string | null {
	const name = value.trim().replace(/^#/, "")
	if (!name) return "Enter a tag name"
	if (/\s/.test(name)) return "Tags can't contain spaces"
	if (name.startsWith("/") || name.endsWith("/") || name.includes("//")) {
		return "Use / only between nested tag names"
	}
	return null
}

function TagNoteRow({
	colors,
	first,
	last,
	note,
	vaultPath,
}: {
	colors: MobileColors
	first: boolean
	last: boolean
	note: TagPageNote
	vaultPath: string
}) {
	const excerpt = useNoteExcerpt(note.filePath, note.modifiedAt)
	const relativePath = toVaultRelativePath(note.filePath, vaultPath) ?? note.filePath
	const folder = getParentPath(relativePath) || "Vault root"
	const when = formatRelativeTime(note.modifiedAt)
	const meta = when ? `${folder} · ${when.charAt(0).toUpperCase()}${when.slice(1)}` : folder

	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: colors.cell },
				first ? styles.first : null,
				last ? styles.last : null,
			]}
		>
			<Pressable
				accessibilityRole="button"
				android_ripple={{ color: colors.hover }}
				onPress={() => openNote(note.filePath)}
				style={({ pressed }) => [
					styles.row,
					{ backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" },
				]}
			>
				<Text numberOfLines={1} style={[styles.rowTitle, { color: colors.label }]}>
					{getNoteTitle(note.filePath)}
				</Text>
				<Text numberOfLines={1} style={[styles.rowMeta, { color: colors.secondaryLabel }]}>
					{meta}
				</Text>
				{excerpt?.firstLine ? (
					<Text numberOfLines={2} style={[styles.rowSnippet, { color: colors.label }]}>
						{excerpt.firstLine}
					</Text>
				) : null}
				{note.tags.length > 0 ? (
					<View style={styles.rowTags}>
						{note.tags.map((tag) => (
							<View key={tag} style={[styles.tagPill, { backgroundColor: colors.tagBackground }]}>
								<Text style={[styles.tagPillText, { color: colors.tagText }]}>#{tag}</Text>
							</View>
						))}
					</View>
				) : null}
			</Pressable>
			{IS_IOS && !last ? (
				<View style={[styles.separator, { backgroundColor: colors.separator }]} />
			) : null}
		</View>
	)
}

export function TagPageScreen() {
	useHideTabBar()
	const { colors } = useMobileColors()
	const params = useLocalSearchParams<{ tag?: string }>()
	const tag = normalizeTagParam(params.tag)
	const vaultPath = useVaultStore((state) => state.vault?.path ?? "")
	const files = useVaultStore((state) => state.files)
	const tagIndex = useTagsStore((state) => state.tagIndex)
	const fileTags = useTagsStore((state) => state.fileTags)
	const tagColor = useTagsStore((state) => state.tagColors[tag] ?? null)
	const indexReady = useEnsureVaultIndexed()
	const [childTag, setChildTag] = useState<string | null>(null)
	const [renaming, setRenaming] = useState(false)
	const [renameError, setRenameError] = useState<string | null>(null)

	const modifiedTimes = useMemo(() => getFileModifiedTimes(files), [files])
	const allModel = useMemo(
		() => getTagPageModel(tag, tagIndex, fileTags, modifiedTimes),
		[fileTags, modifiedTimes, tag, tagIndex],
	)
	const model = useMemo(
		() =>
			childTag ? getTagPageModel(tag, tagIndex, fileTags, modifiedTimes, { childTag }) : allModel,
		[allModel, childTag, fileTags, modifiedTimes, tag, tagIndex],
	)
	const sections = [
		{ title: "Recently edited", data: model.recent },
		{ title: "Older", data: model.older },
	].filter((section) => section.data.length > 0)
	const colorOptions = getTagColorOptions(colors)
	const dotColor = resolveTagColor(tagColor, colors)

	const openSearch = () => {
		router.navigate({ pathname: "/(tabs)/(search)", params: { tag } } as Href)
	}

	const setColor = (color: string | null) => {
		if (!vaultPath) return
		void useTagsStore
			.getState()
			.setTagColor(vaultPath, tag, color)
			.catch((error: unknown) => toast(getErrorMessage(error)))
	}

	const rename = async (value: string) => {
		const nextTag = value.trim().replace(/^#/, "")
		setRenaming(false)
		if (!vaultPath || nextTag === tag) return
		try {
			const count = await useTagsStore.getState().renameTag(vaultPath, tag, nextTag)
			toast(`Renamed #${tag} in ${count} ${count === 1 ? "note" : "notes"}`)
			router.setParams({ tag: nextTag })
			setChildTag(null)
		} catch (error) {
			toast(getErrorMessage(error))
		}
	}

	const colourItems: MenuItem[] = [
		...colorOptions.map((option) => ({
			checked: tagColor === option.value,
			key: option.key,
			label: option.label,
			onPress: () => setColor(option.value),
		})),
		{
			checked: tagColor === null,
			key: "none",
			label: "No colour",
			onPress: () => setColor(null),
		},
	]

	const subtitle = `${allModel.noteCount} ${allModel.noteCount === 1 ? "note" : "notes"}`

	return (
		<>
			<Stack.Screen
				options={{
					headerLargeTitleEnabled: IS_IOS,
					headerRight: IS_IOS
						? undefined
						: () => (
								<View style={styles.androidActions}>
									<HeaderIconButton
										accessibilityLabel="Search in tag"
										Icon={Search}
										onPress={openSearch}
									/>
									<NativeMenu
										accessibilityLabel="Tag actions: rename, change colour"
										groups={[
											[
												{
													icon: { Lucide: Pencil, sf: "pencil" },
													key: "rename",
													label: "Rename tag…",
													onPress: () => {
														setRenameError(null)
														setRenaming(true)
													},
												},
												{
													disabled: true,
													icon: { Lucide: Palette, sf: "paintpalette" },
													key: "colour",
													label: "Change colour",
													onPress: () => {},
												},
											],
											colourItems,
										]}
										icon={{ Lucide: MoreVertical, sf: "ellipsis" }}
									/>
								</View>
							),
					title: `#${tag}`,
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button
						accessibilityLabel="Search in tag"
						icon="magnifyingglass"
						onPress={openSearch}
					/>
					<Stack.Toolbar.Menu
						accessibilityLabel="Tag actions: rename, change colour"
						icon="ellipsis"
						title="Tag actions"
					>
						<Stack.Toolbar.MenuAction
							icon="pencil"
							onPress={() => {
								setRenameError(null)
								setRenaming(true)
							}}
						>
							Rename tag…
						</Stack.Toolbar.MenuAction>
						<Stack.Toolbar.Menu icon="paintpalette" title="Change colour">
							{colourItems.map((item) => (
								<Stack.Toolbar.MenuAction isOn={item.checked} key={item.key} onPress={item.onPress}>
									{item.label}
								</Stack.Toolbar.MenuAction>
							))}
						</Stack.Toolbar.Menu>
					</Stack.Toolbar.Menu>
				</Stack.Toolbar>
			) : null}
			<SectionList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyExtractor={(note) => note.filePath}
				ListEmptyComponent={
					indexReady ? (
						<EmptyState description={`No notes are tagged #${childTag ?? tag}.`} title="No notes" />
					) : (
						<View style={styles.loading}>
							<ActivityIndicator color={colors.tint} />
						</View>
					)
				}
				ListHeaderComponent={
					<>
						<View style={styles.subtitleRow}>
							<View style={[styles.dot, { backgroundColor: dotColor }]} />
							<Text style={[styles.subtitle, { color: colors.secondaryLabel }]}>{subtitle}</Text>
						</View>
						{allModel.childTags.length > 0 ? (
							<FlatList
								contentContainerStyle={styles.chips}
								data={[null, ...allModel.childTags]}
								horizontal
								keyExtractor={(child) => child?.tag ?? "__all"}
								renderItem={({ item: child }) =>
									child ? (
										<FilterChip
											label={`#${child.tag} ${child.count}`}
											onPress={() => setChildTag(child.tag)}
											selected={childTag === child.tag}
										/>
									) : (
										<FilterChip
											label={`All ${allModel.noteCount}`}
											onPress={() => setChildTag(null)}
											selected={childTag === null}
										/>
									)
								}
								showsHorizontalScrollIndicator={false}
							/>
						) : null}
					</>
				}
				renderItem={({ item, index, section }) => (
					<TagNoteRow
						colors={colors}
						first={index === 0}
						last={index === section.data.length - 1}
						note={item}
						vaultPath={vaultPath}
					/>
				)}
				renderSectionHeader={({ section }) => (
					<GroupedSectionHeader>{section.title}</GroupedSectionHeader>
				)}
				sections={sections}
				stickySectionHeadersEnabled={false}
				style={{ backgroundColor: colors.groupedBackground }}
			/>
			<TextPromptDialog
				confirmLabel="Rename"
				error={renameError}
				initialValue={tag}
				key={renaming ? `rename-${tag}` : "rename-closed"}
				message={`Updates #${tag} and its nested tags in every note.`}
				onCancel={() => setRenaming(false)}
				onChangeText={(value) => setRenameError(getTagNameError(value))}
				onConfirm={(value) => void rename(value)}
				placeholder="Tag name"
				title="Rename tag"
				visible={renaming}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	androidActions: {
		alignItems: "center",
		flexDirection: "row",
	},
	card: {
		marginHorizontal: 16,
		overflow: "hidden",
	},
	chips: {
		flexDirection: "row",
		gap: 8,
		paddingBottom: 4,
		paddingHorizontal: 16,
		paddingTop: 8,
	},
	content: {
		paddingBottom: 32,
	},
	dot: {
		borderRadius: 4,
		height: 14,
		width: 14,
	},
	first: {
		borderTopLeftRadius: IS_IOS ? 26 : 20,
		borderTopRightRadius: IS_IOS ? 26 : 20,
	},
	last: {
		borderBottomLeftRadius: IS_IOS ? 26 : 20,
		borderBottomRightRadius: IS_IOS ? 26 : 20,
	},
	loading: {
		paddingVertical: 40,
	},
	row: {
		gap: 2,
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	rowMeta: {
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: IS_IOS ? 18 : 20,
	},
	rowSnippet: {
		fontSize: 15,
		lineHeight: 20,
		marginTop: 2,
	},
	rowTags: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 6,
		marginTop: 6,
	},
	rowTitle: {
		fontSize: IS_IOS ? 17 : 16,
		fontWeight: IS_IOS ? "400" : "500",
		lineHeight: IS_IOS ? 22 : 24,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 16,
	},
	subtitle: {
		fontSize: 15,
		lineHeight: 20,
	},
	subtitleRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
		paddingHorizontal: 20,
		paddingTop: 2,
	},
	tagPill: {
		borderRadius: 999,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	tagPillText: {
		fontSize: 13,
		fontWeight: "500",
		lineHeight: 18,
	},
})
