import { getBaseName, getParentPath } from "@cortex/core"
import {
	type DatabaseFilter,
	type DatabaseGroup,
	type DatabaseRow,
	getDatabaseRowTitle,
} from "@cortex/properties/database"
import { Stack, useLocalSearchParams } from "expo-router"
import { useMemo, useState } from "react"
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { FilterChip } from "@/components/ui/FilterChip"
import type { MenuGroup, MenuItem } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SymbolIcon } from "@/components/ui/Symbol"
import {
	type DatabaseRowTemplateChoice,
	listDatabaseRowTemplates,
} from "@/features/database/databaseAdapter"
import { DatabaseBoardView } from "@/features/database/DatabaseBoardView"
import { DatabaseCalendarView } from "@/features/database/DatabaseCalendarView"
import { DatabaseFabMenu } from "@/features/database/DatabaseFabMenu"
import {
	describeFilter,
	groupTokenLabel,
	noteCountLabel,
	sameFilter,
	sortTokenLabel,
	type ViewOptionsTab,
} from "@/features/database/databaseFormat"
import { DatabaseGalleryView } from "@/features/database/DatabaseGalleryView"
import {
	openDatabaseRow,
	openDatabaseViewOptions,
	openNewDatabase,
	readParam,
} from "@/features/database/databaseNavigation"
import {
	type DatabaseCollectionProps,
	DatabaseTableView,
} from "@/features/database/DatabaseTableView"
import { DatabaseViewBar } from "@/features/database/DatabaseViewBar"
import { type DatabaseViewModel, useDatabaseView } from "@/features/database/useDatabaseView"
import { showToast } from "@/features/feedback/toastStore"
import { presentSheet } from "@/features/navigation/routes"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"
const TABLE_ICON = { md: "table", sf: "tablecells" } as const

function templateIcon(template: DatabaseRowTemplateChoice): MenuItem["icon"] {
	if (/bug/iu.test(template.id)) return { md: "bug_report", sf: "ladybug" }
	return { md: "description", sf: "doc.text" }
}

function buildNewGroups(
	templates: DatabaseRowTemplateChoice[],
	create: (template?: DatabaseRowTemplateChoice) => void,
): MenuGroup[] {
	return [
		[
			{
				icon: { md: "edit_square", sf: "square.and.pencil" },
				key: "new-note",
				label: "New note",
				onPress: () => create(),
			},
		],
		[
			...templates.map((template) => ({
				icon: templateIcon(template),
				key: `template-${template.id}`,
				label: template.name,
				onPress: () => create(template),
				subtitle: template.subtitle || undefined,
			})),
			{
				icon: { md: "sticky_note_2", sf: "note.text" },
				key: "blank-note",
				label: "Blank note",
				onPress: () => create(),
			},
		],
	]
}

function buildMoreGroups(folderPath: string, viewId: string | undefined): MenuGroup[] {
	return [
		[
			{
				icon: { md: "share", sf: "square.and.arrow.up" },
				key: "share-template",
				label: "Share as template…",
				onPress: () => presentSheet("share-template", { folderPath }),
			},
			{
				icon: { md: "tune", sf: "slider.horizontal.3" },
				key: "properties",
				label: "Properties",
				onPress: () => openDatabaseViewOptions(folderPath, viewId, "props"),
			},
			{
				icon: { md: "library_add", sf: "plus.rectangle.on.rectangle" },
				key: "new-database",
				label: "New database",
				onPress: () => openNewDatabase({ parentPath: getParentPath(folderPath) }),
			},
		],
	]
}

function toolbarActions(items: MenuItem[]) {
	return items.map((item) => (
		<Stack.Toolbar.MenuAction
			icon={item.icon?.sf}
			key={item.key}
			onPress={item.onPress}
			subtitle={item.subtitle}
		>
			{item.label}
		</Stack.Toolbar.MenuAction>
	))
}

function DatabaseHeaderIos({
	moreGroups,
	name,
	newGroups,
}: {
	moreGroups: MenuGroup[]
	name: string
	newGroups: MenuGroup[]
}) {
	const [first = [], templates = []] = newGroups
	return (
		<>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Menu accessibilityLabel="More" icon="ellipsis" title={name}>
					{toolbarActions(moreGroups.flat())}
				</Stack.Toolbar.Menu>
			</Stack.Toolbar>
			<Stack.Toolbar placement="bottom">
				<Stack.Toolbar.SearchBarSlot />
				<Stack.Toolbar.Menu
					accessibilityLabel={`New note in ${name}`}
					icon="plus"
					separateBackground
					title="New"
					variant="prominent"
				>
					{toolbarActions(first)}
					<Stack.Toolbar.Menu inline title="Start from a template">
						{toolbarActions(templates)}
					</Stack.Toolbar.Menu>
				</Stack.Toolbar.Menu>
			</Stack.Toolbar>
		</>
	)
}

function ViewTokens({ folderPath, model }: { folderPath: string; model: DatabaseViewModel }) {
	const view = model.activeView
	const filters = view?.filters ?? []
	const open = (tab: ViewOptionsTab) => {
		triggerSelectionHaptic()
		openDatabaseViewOptions(folderPath, view?.id, tab)
	}
	const removeFilter = (filter: DatabaseFilter) => {
		triggerSelectionHaptic()
		model.updateView((current) => {
			const next = (current.filters ?? []).filter((item) => !sameFilter(item, filter))
			return { ...current, filters: next.length ? next : undefined }
		})
	}

	return (
		<>
			<ScrollView
				accessibilityLabel="View options"
				contentContainerStyle={styles.tokens}
				horizontal
				showsHorizontalScrollIndicator={false}
			>
				<FilterChip
					label={filters.length ? `Filter · ${filters.length}` : "Filter"}
					onPress={() => open("filter")}
					selected={filters.length > 0}
				/>
				<FilterChip label={sortTokenLabel(view, model.resolved)} onPress={() => open("sort")} />
				<FilterChip label={groupTokenLabel(view, model.resolved)} onPress={() => open("group")} />
				<FilterChip label="Properties" onPress={() => open("props")} />
			</ScrollView>
			{filters.length > 0 ? (
				<View accessibilityLabel="Active filters" style={styles.activeFilters}>
					{filters.map((filter) => {
						const label = describeFilter(filter, model.resolved, model.authorConfig)
						const text = `${label.property} ${label.operator}${label.value ? ` ${label.value}` : ""}`
						return (
							<FilterChip
								accessibilityLabel={`Remove filter ${text}`}
								key={`${filter.key}-${filter.op}-${JSON.stringify(filter.value)}`}
								label={text}
								onRemove={() => removeFilter(filter)}
								selected
							/>
						)
					})}
				</View>
			) : null}
		</>
	)
}

function DatabaseCollection(props: DatabaseCollectionProps) {
	const { colors } = useMobileColors()
	const { highlighted, model, onOpenRow } = props
	if (model.loading) return <ActivityIndicator color={colors.tint} style={styles.loading} />
	switch (model.activeView?.type) {
		case "board":
			return <DatabaseBoardView {...props} />
		case "calendar":
			return <DatabaseCalendarView model={model} onOpenRow={onOpenRow} />
		case "gallery":
			return <DatabaseGalleryView highlighted={highlighted} model={model} onOpenRow={onOpenRow} />
		default:
			return <DatabaseTableView {...props} />
	}
}

export function DatabaseScreen() {
	useHideTabBar()
	const params = useLocalSearchParams<{
		folderPath?: string | string[]
		view?: string | string[]
	}>()
	const folderPath = readParam(params.folderPath) ?? ""
	const { colors } = useMobileColors()
	const [search, setSearch] = useState("")
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
	const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(() => new Set())
	const model = useDatabaseView(folderPath, readParam(params.view), search)
	const name = model.entry?.name ?? getBaseName(folderPath)
	const viewId = model.activeView?.id
	const templates = useMemo(() => listDatabaseRowTemplates(model.config), [model.config])

	const openRow = (row: DatabaseRow) => openDatabaseRow(folderPath, row.path, viewId)

	async function createRow(group: DatabaseGroup | null, template?: DatabaseRowTemplateChoice) {
		triggerSelectionHaptic()
		const created = await model.createRow(group, template)
		if (!created) return
		const title = getDatabaseRowTitle(created.path)
		setHighlighted((current) => new Set(current).add(created.path))
		showToast(`${title} added to ${name}`, {
			action: { label: "Open", onPress: () => openDatabaseRow(folderPath, created.path, viewId) },
		})
	}

	const newGroups = buildNewGroups(templates, (template) => void createRow(null, template))
	const moreGroups = buildMoreGroups(folderPath, viewId)

	function toggleGroup(key: string) {
		setCollapsed((current) => {
			const next = new Set(current)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	return (
		<>
			<ScrollView
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				style={{ backgroundColor: colors.background }}
			>
				<View style={styles.countRow}>
					<SymbolIcon color={colors.tint} name={TABLE_ICON} size={18} />
					<Text style={[styles.count, { color: colors.secondaryLabel }]}>
						{noteCountLabel(model.result?.matchedCount ?? 0)}
					</Text>
				</View>
				{model.entry ? (
					<>
						<DatabaseViewBar model={model} />
						<ViewTokens folderPath={folderPath} model={model} />
						<DatabaseCollection
							collapsed={collapsed}
							highlighted={highlighted}
							model={model}
							onCreate={(group) => void createRow(group)}
							onOpenRow={openRow}
							onToggleGroup={toggleGroup}
						/>
					</>
				) : model.registryReady ? (
					<EmptyState
						icon={TABLE_ICON}
						description="This folder has no database view note yet. Use New database to turn it into one."
						title="Not a database"
					/>
				) : (
					<ActivityIndicator color={colors.tint} style={styles.loading} />
				)}
			</ScrollView>
			<Stack.Screen
				options={{
					headerRight: IS_IOS
						? undefined
						: () => (
								<NativeMenu
									accessibilityLabel="More"
									groups={moreGroups}
									icon={{ md: "more_vert", sf: "ellipsis" }}
								/>
							),
					title: name,
				}}
			/>
			<Stack.SearchBar
				hideWhenScrolling={false}
				onChangeText={(event) => setSearch(event.nativeEvent.text)}
				placeholder={`Search ${name}`}
			/>
			{IS_IOS ? (
				<DatabaseHeaderIos moreGroups={moreGroups} name={name} newGroups={newGroups} />
			) : model.entry ? (
				<DatabaseFabMenu groups={newGroups} />
			) : null}
		</>
	)
}

const styles = StyleSheet.create({
	activeFilters: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		paddingBottom: 8,
		paddingHorizontal: 16,
	},
	content: {
		paddingBottom: 140,
	},
	count: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
	},
	countRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		paddingBottom: 10,
		paddingHorizontal: 20,
		paddingTop: IS_IOS ? 0 : 4,
	},
	loading: {
		marginTop: 40,
	},
	tokens: {
		gap: 8,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
})
