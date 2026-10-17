import {
	formatRelativeTime,
	getNoteTitle,
	getParentPath,
	getTagPageModel,
	type TagPageNote,
	toVaultRelativePath,
	useTagsStore,
	useVaultModifiedTimes,
	useVaultStore,
} from "@cortex/core"
import { type Href, router, Stack, useLocalSearchParams } from "expo-router"
import { useMemo, useState } from "react"
import { ActivityIndicator, Platform, SectionList, StyleSheet, Text, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { TextPromptDialog } from "@/components/ui/TextPromptDialog"
import { openNote } from "@/features/navigation/routes"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import { ListCell, ListSectionHeader } from "@/features/search/ListCell"
import { useNoteExcerpt } from "@/features/search/noteExcerpts"
import { useEnsureVaultIndexed } from "@/features/search/vaultIndexing"
import {
	getTagColorChoices,
	getTagNameError,
	promptRenameTag,
	renameTagInVault,
	setTagColorInVault,
} from "@/features/tags/tagActions"
import { getTagColorOptions } from "@/features/tags/tagColors"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"

function normalizeTagParam(value: string | string[] | undefined): string {
	const raw = Array.isArray(value) ? value[0] : value
	return (raw ?? "").replace(/^#/, "").trim()
}

function TagNoteRow({
	colors,
	first,
	last,
	note,
	vaultName,
	vaultPath,
}: {
	colors: MobileColors
	first: boolean
	last: boolean
	note: TagPageNote
	vaultName: string
	vaultPath: string
}) {
	const excerpt = useNoteExcerpt(note.filePath, note.modifiedAt)
	const relativePath = toVaultRelativePath(note.filePath, vaultPath) ?? note.filePath
	const folderPath = getParentPath(relativePath)
	const folder = folderPath ? folderPath.slice(folderPath.lastIndexOf("/") + 1) : vaultName
	const when = formatRelativeTime(note.modifiedAt)
	const meta = when ? `${folder} · ${when.charAt(0).toUpperCase()}${when.slice(1)}` : folder

	return (
		<ListCell first={first} last={last} onPress={() => openNote(note.filePath)}>
			<View style={styles.row}>
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
			</View>
		</ListCell>
	)
}

export function TagPageScreen() {
	useHideTabBar()
	const { colors } = useMobileColors()
	const params = useLocalSearchParams<{ tag?: string }>()
	const tag = normalizeTagParam(params.tag)
	const vaultPath = useVaultStore((state) => state.vault?.path ?? "")
	const vaultName = useVaultStore((state) => state.vault?.name ?? "Vault")
	const modifiedTimes = useVaultModifiedTimes()
	const tagIndex = useTagsStore((state) => state.tagIndex)
	const fileTags = useTagsStore((state) => state.fileTags)
	const tagColor = useTagsStore((state) => state.tagColors[tag] ?? null)
	const indexReady = useEnsureVaultIndexed()
	const [childTag, setChildTag] = useState<string | null>(null)
	const [renaming, setRenaming] = useState(false)
	const [renameError, setRenameError] = useState<string | null>(null)

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
	const colorChoices = getTagColorChoices(getTagColorOptions(colors))
	const hasChildren = allModel.childTags.length > 0

	const openSearch = () => {
		router.navigate({ pathname: "/(tabs)/(search)", params: { tag } } as Href)
	}

	const handleRenamed = (nextTag: string) => {
		router.setParams({ tag: nextTag })
		setChildTag(null)
	}

	const startRename = () => {
		if (IS_IOS) {
			promptRenameTag(vaultPath, tag, handleRenamed)
			return
		}
		setRenameError(null)
		setRenaming(true)
	}

	const confirmRename = async (value: string) => {
		setRenaming(false)
		const nextTag = await renameTagInVault(vaultPath, tag, value)
		if (nextTag) handleRenamed(nextTag)
	}

	const showItems = [
		{
			checked: childTag === null,
			key: "all",
			label: `All notes (${allModel.noteCount})`,
			onPress: () => setChildTag(null),
		},
		...allModel.childTags.map((child) => ({
			checked: childTag === child.tag,
			key: child.tag,
			label: `#${child.tag} (${child.count})`,
			onPress: () => setChildTag(child.tag),
		})),
	]

	const androidGroups: MenuGroup[] = [
		[
			{
				icon: { md: "search", sf: "magnifyingglass" },
				key: "search",
				label: "Search in tag",
				onPress: openSearch,
			},
			{
				icon: { md: "edit", sf: "pencil" },
				key: "rename",
				label: "Rename tag…",
				onPress: startRename,
			},
		],
		colorChoices.map((choice) => ({
			checked: tagColor === choice.value,
			key: `colour:${choice.key}`,
			label: choice.label,
			onPress: () => setTagColorInVault(vaultPath, tag, choice.value),
		})),
	]

	return (
		<>
			<Stack.Screen
				options={{
					headerLargeTitleEnabled: IS_IOS,
					headerRight: IS_IOS
						? undefined
						: () => (
								<View style={styles.androidActions}>
									{hasChildren ? (
										<NativeMenu
											accessibilityLabel="Show nested tags"
											groups={[showItems]}
											header="Show"
											icon={{ md: "filter_list", sf: "line.3.horizontal.decrease.circle" }}
										/>
									) : null}
									<NativeMenu
										accessibilityLabel="Tag actions"
										groups={androidGroups}
										icon={{ md: "more_vert", sf: "ellipsis" }}
									/>
								</View>
							),
					title: `#${tag}`,
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					{hasChildren ? (
						<Stack.Toolbar.Menu
							accessibilityLabel="Show nested tags"
							icon={
								childTag
									? "line.3.horizontal.decrease.circle.fill"
									: "line.3.horizontal.decrease.circle"
							}
							title="Show"
						>
							{showItems.map((item) => (
								<Stack.Toolbar.MenuAction isOn={item.checked} key={item.key} onPress={item.onPress}>
									{item.label}
								</Stack.Toolbar.MenuAction>
							))}
						</Stack.Toolbar.Menu>
					) : null}
					<Stack.Toolbar.Menu accessibilityLabel="Tag actions" icon="ellipsis" title={`#${tag}`}>
						<Stack.Toolbar.MenuAction icon="magnifyingglass" onPress={openSearch}>
							Search in tag
						</Stack.Toolbar.MenuAction>
						<Stack.Toolbar.MenuAction icon="pencil" onPress={startRename}>
							Rename tag…
						</Stack.Toolbar.MenuAction>
						<Stack.Toolbar.Menu icon="paintpalette" title="Colour">
							{colorChoices.map((choice) => (
								<Stack.Toolbar.MenuAction
									isOn={tagColor === choice.value}
									key={choice.key}
									onPress={() => setTagColorInVault(vaultPath, tag, choice.value)}
								>
									{choice.label}
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
						<EmptyState
							description={`No notes are tagged #${childTag ?? tag}.`}
							icon={{ md: "tag", sf: "number" }}
							title="No notes"
						/>
					) : (
						<View style={styles.loading}>
							<ActivityIndicator color={colors.tint} />
						</View>
					)
				}
				renderItem={({ item, index, section }) => (
					<TagNoteRow
						colors={colors}
						first={index === 0}
						last={index === section.data.length - 1}
						note={item}
						vaultName={vaultName}
						vaultPath={vaultPath}
					/>
				)}
				renderSectionHeader={({ section }) => (
					<ListSectionHeader>
						{childTag ? `#${childTag} · ${section.title}` : section.title}
					</ListSectionHeader>
				)}
				sections={sections}
				stickySectionHeadersEnabled={false}
				style={{ backgroundColor: colors.groupedBackground }}
			/>
			{IS_IOS ? null : (
				<TextPromptDialog
					confirmLabel="Rename"
					error={renameError}
					initialValue={tag}
					key={renaming ? `rename-${tag}` : "rename-closed"}
					message={`Updates #${tag} and its nested tags in every note.`}
					onCancel={() => setRenaming(false)}
					onChangeText={(value) => setRenameError(getTagNameError(value))}
					onConfirm={(value) => void confirmRename(value)}
					placeholder="Tag name"
					title="Rename tag"
					visible={renaming}
				/>
			)}
		</>
	)
}

const styles = StyleSheet.create({
	androidActions: {
		alignItems: "center",
		flexDirection: "row",
	},
	content: {
		paddingBottom: 32,
	},
	loading: {
		paddingVertical: 40,
	},
	row: {
		flex: 1,
		gap: 2,
		minWidth: 0,
		paddingVertical: 2,
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
