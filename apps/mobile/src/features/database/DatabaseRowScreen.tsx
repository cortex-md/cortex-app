import {
	createWikiLinkResolver,
	getBaseName,
	getErrorMessage,
	saveDatabaseRowTemplate,
	selectBacklinks,
	updateDatabaseCell,
	useLinksStore,
	useVaultStore,
} from "@cortex/core"
import {
	getPropertyValueList,
	getSortedPropertyOptions,
	isEmptyPropertyValue,
	type PropertyDefinition,
	resolvePropertyOption,
} from "@cortex/properties"
import { type DatabaseRow, getPropertyBaseType } from "@cortex/properties/database"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { type ReactNode, useMemo, useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import { EmptyState } from "@/components/ui/EmptyState"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SymbolIcon, type SymbolName } from "@/components/ui/Symbol"
import { dueToneColor, OptionPill } from "@/features/database/DatabaseCells"
import {
	formatEditedAgo,
	formatLongDue,
	formatPropertyValue,
	isRowDone,
	optionTone,
	resolvePersonName,
} from "@/features/database/databaseFormat"
import { readParam } from "@/features/database/databaseNavigation"
import { parseRowBody, RowNoteBody } from "@/features/database/RowNoteBody"
import { StatusPicker } from "@/features/database/StatusPicker"
import { type DatabaseViewModel, useDatabaseView } from "@/features/database/useDatabaseView"
import { useRowNote } from "@/features/database/useRowNote"
import { toast } from "@/features/feedback/useToast"
import { openNote, presentSheet } from "@/features/navigation/routes"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"

const PROPERTY_ICONS: Record<string, SymbolName> = {
	checkbox: { md: "check_box", sf: "checkmark.square" },
	date: { md: "calendar_today", sf: "calendar" },
	number: { md: "tag", sf: "number" },
	person: { md: "person", sf: "person" },
	select: { md: "radio_button_checked", sf: "smallcircle.filled.circle" },
	tags: { md: "sell", sf: "tag" },
}
const TEXT_ICON: SymbolName = { md: "notes", sf: "textformat" }

function PropertyIcon({ color, definition }: { color: string; definition: PropertyDefinition }) {
	const icon = PROPERTY_ICONS[getPropertyBaseType(definition)] ?? TEXT_ICON
	return <SymbolIcon color={color} name={icon} size={14} />
}

function useBacklinkCount(filePath: string): number {
	const vault = useVaultStore((state) => state.vault)
	const files = useVaultStore((state) => state.files)
	const outgoing = useLinksStore((state) => state.outgoing)
	return useMemo(
		() =>
			vault
				? selectBacklinks(outgoing, filePath, createWikiLinkResolver(files, vault.path)).length
				: 0,
		[files, filePath, outgoing, vault],
	)
}

function orderedRows(model: DatabaseViewModel, filePath: string): DatabaseRow[] {
	const visible = model.result?.rows ?? []
	if (visible.some((row) => row.path === filePath)) return visible
	return [...model.rows].sort((left, right) => left.title.localeCompare(right.title))
}

function PropertyLine({
	definition,
	children,
}: {
	definition: PropertyDefinition
	children: ReactNode
}) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.propRow}>
			<View style={styles.propKey}>
				<PropertyIcon color={colors.secondaryLabel} definition={definition} />
				<Text numberOfLines={1} style={[styles.propKeyText, { color: colors.secondaryLabel }]}>
					{definition.name}
				</Text>
			</View>
			<View style={styles.propValue}>{children}</View>
		</View>
	)
}

function PropertyValue({
	definition,
	model,
	row,
}: {
	definition: PropertyDefinition
	model: DatabaseViewModel
	row: DatabaseRow
}) {
	const { colors } = useMobileColors()
	const value = row.meta[definition.key]
	const baseType = getPropertyBaseType(definition)
	if (baseType === "date") {
		const due = formatLongDue(value, model.queryContext.today, isRowDone(row, model.roles))
		return (
			<Text style={[styles.valueText, { color: dueToneColor(due.tone, colors) }]}>{due.label}</Text>
		)
	}
	if (isEmptyPropertyValue(value)) {
		return <Text style={[styles.valueText, { color: colors.tertiaryLabel }]}>Empty</Text>
	}
	if (baseType === "person") {
		const name = resolvePersonName(getPropertyValueList(value)[0], model.authorConfig)
		return (
			<View style={styles.inline}>
				<Avatar name={name} size={22} />
				<Text style={[styles.valueText, { color: colors.label }]}>{name}</Text>
			</View>
		)
	}
	if (baseType === "select") {
		return (
			<View style={styles.inline}>
				{getPropertyValueList(value).map((item) => (
					<OptionPill key={String(item)} option={resolvePropertyOption(definition, item)} />
				))}
			</View>
		)
	}
	if (baseType === "tags") {
		return (
			<View style={styles.inline}>
				{getPropertyValueList(value).map((item) => (
					<View key={String(item)} style={[styles.tag, { backgroundColor: colors.tagBackground }]}>
						<Text style={[styles.tagText, { color: colors.tagText }]}>{`#${String(item)}`}</Text>
					</View>
				))}
			</View>
		)
	}
	return (
		<Text style={[styles.valueText, { color: colors.label }]}>
			{formatPropertyValue(definition, value, model.authorConfig)}
		</Text>
	)
}

function RowPager({
	filePath,
	index,
	onStep,
	total,
}: {
	filePath: string
	index: number
	onStep: (delta: number) => void
	total: number
}) {
	const { colors } = useMobileColors()
	const position = `${index + 1} of ${total}`

	if (IS_IOS) {
		return (
			<Stack.Toolbar placement="bottom">
				<Stack.Toolbar.Button
					accessibilityLabel="Previous note"
					icon="chevron.up"
					onPress={() => onStep(-1)}
				/>
				<Stack.Toolbar.Button
					accessibilityLabel="Next note"
					icon="chevron.down"
					onPress={() => onStep(1)}
				/>
				<Stack.Toolbar.View>
					<View style={styles.positionPill}>
						<Text style={[styles.positionText, { color: colors.secondaryLabel }]}>{position}</Text>
					</View>
				</Stack.Toolbar.View>
				<Stack.Toolbar.Spacer />
				<Stack.Toolbar.Button
					accessibilityLabel="Open in a new tab"
					icon="plus.square.on.square"
					onPress={() => openNote(filePath)}
				/>
			</Stack.Toolbar>
		)
	}

	return (
		<View pointerEvents="box-none" style={styles.androidBar}>
			<View style={[styles.androidPager, { backgroundColor: colors.fill }]}>
				<Pressable
					accessibilityLabel="Previous note"
					android_ripple={{ borderless: true, color: colors.hover }}
					onPress={() => onStep(-1)}
					style={styles.androidIcon}
				>
					<SymbolIcon
						color={colors.label}
						name={{ md: "keyboard_arrow_up", sf: "chevron.up" }}
						size={24}
					/>
				</Pressable>
				<Pressable
					accessibilityLabel="Next note"
					android_ripple={{ borderless: true, color: colors.hover }}
					onPress={() => onStep(1)}
					style={styles.androidIcon}
				>
					<SymbolIcon
						color={colors.label}
						name={{ md: "keyboard_arrow_down", sf: "chevron.down" }}
						size={24}
					/>
				</Pressable>
				<Text style={[styles.androidPosition, { color: colors.secondaryLabel }]}>{position}</Text>
			</View>
			<Pressable
				accessibilityLabel="Open in a new tab"
				accessibilityRole="button"
				android_ripple={{ color: colors.hover }}
				onPress={() => openNote(filePath)}
				style={[styles.androidFab, { backgroundColor: colors.accentSubtle }]}
			>
				<SymbolIcon
					color={colors.tint}
					name={{ md: "open_in_new", sf: "plus.square.on.square" }}
					size={24}
				/>
			</Pressable>
		</View>
	)
}

export function DatabaseRowScreen() {
	useHideTabBar()
	const params = useLocalSearchParams<{
		filePath?: string | string[]
		folderPath?: string | string[]
		viewId?: string | string[]
	}>()
	const filePath = readParam(params.filePath) ?? ""
	const folderPath = readParam(params.folderPath) ?? ""
	const { colors } = useMobileColors()
	const model = useDatabaseView(folderPath, readParam(params.viewId))
	const row = model.rows.find((item) => item.path === filePath)
	const ordered = orderedRows(model, filePath)
	const index = ordered.findIndex((item) => item.path === filePath)
	const [statusOpen, setStatusOpen] = useState(false)
	const [showMore, setShowMore] = useState(false)
	const backlinks = useBacklinkCount(filePath)
	const note = useRowNote(filePath, row?.mtime ?? 0, model.queryContext.today)
	const databaseName = model.entry?.name ?? getBaseName(folderPath)
	const title = row?.title ?? getBaseName(filePath).replace(/\.md$/iu, "")
	const blocks = parseRowBody(note.body ?? "", title)

	const { ownerKey, statusKey, dateKey } = model.roles
	const primary = [statusKey, ownerKey, dateKey]
		.map((key) => (key ? model.resolved.byKey.get(key) : undefined))
		.filter((definition): definition is PropertyDefinition => Boolean(definition))
	const primaryKeys = new Set(primary.map((definition) => definition.key))
	const extra = model.resolved.properties.filter(
		(definition) =>
			!primaryKeys.has(definition.key) &&
			(model.activeView?.columns?.includes(definition.key) ||
				!isEmptyPropertyValue(row?.meta[definition.key])),
	)
	const statusDefinition = statusKey ? model.resolved.byKey.get(statusKey) : undefined
	const statusValue = statusKey ? getPropertyValueList(row?.meta[statusKey])[0] : undefined
	const statusOptions = statusDefinition
		? getSortedPropertyOptions(statusDefinition).map((option) => ({
				id: option.id,
				label: option.label,
				tone: optionTone(option.color),
			}))
		: []

	function step(delta: number) {
		if (ordered.length === 0) return
		triggerSelectionHaptic()
		const next = ordered[(Math.max(index, 0) + delta + ordered.length) % ordered.length]
		if (next) router.setParams({ filePath: next.path })
	}

	function selectStatus(id: string) {
		if (!statusDefinition || !row) return
		triggerSelectionHaptic()
		void updateDatabaseCell(
			folderPath,
			row.path,
			statusDefinition.key,
			statusDefinition.multiple ? [id] : id,
		)
	}

	function saveAsTemplate() {
		void saveDatabaseRowTemplate(folderPath, filePath, title).then(
			() => toast(`Saved "${title}" as a template`),
			(error: unknown) => toast(getErrorMessage(error)),
		)
	}

	const moreGroups: MenuGroup[] = [
		[
			{
				icon: { md: "edit_note", sf: "square.and.pencil" },
				key: "open",
				label: "Open in editor",
				onPress: () => openNote(filePath),
			},
			{
				icon: { md: "tune", sf: "slider.horizontal.3" },
				key: "properties",
				label: "Properties",
				onPress: () => presentSheet("properties", { filePath }),
			},
			{
				icon: { md: "note_add", sf: "doc.badge.plus" },
				key: "template",
				label: "Save as row template",
				onPress: saveAsTemplate,
			},
		],
	]

	return (
		<>
			<ScrollView
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.background }}
			>
				{row ? (
					<>
						<Text accessibilityRole="header" style={[styles.h1, { color: colors.label }]}>
							{title}
						</Text>
						{primary.length > 0 || extra.length > 0 ? (
							<View style={[styles.propsBox, { borderColor: colors.border }]}>
								{primary.map((definition) => (
									<PropertyLine definition={definition} key={definition.key}>
										{definition.key === statusKey ? (
											<Pressable
												accessibilityHint="Opens the status chooser"
												accessibilityRole="button"
												onPress={() => setStatusOpen(true)}
											>
												{statusValue !== undefined && statusDefinition ? (
													<OptionPill
														option={resolvePropertyOption(statusDefinition, statusValue)}
													/>
												) : (
													<Text style={[styles.valueText, { color: colors.tertiaryLabel }]}>
														Empty
													</Text>
												)}
											</Pressable>
										) : (
											<PropertyValue definition={definition} model={model} row={row} />
										)}
									</PropertyLine>
								))}
								{showMore
									? extra.map((definition) => (
											<PropertyLine definition={definition} key={definition.key}>
												<PropertyValue definition={definition} model={model} row={row} />
											</PropertyLine>
										))
									: null}
							</View>
						) : null}
						{extra.length > 0 ? (
							<Pressable
								accessibilityRole="button"
								onPress={() => setShowMore((current) => !current)}
								style={styles.propsAdd}
							>
								<Text style={[styles.propsAddText, { color: colors.secondaryLabel }]}>
									{showMore
										? `Hide ${extra.length} ${extra.length === 1 ? "property" : "properties"}`
										: `+ ${extra.length} more ${extra.length === 1 ? "property" : "properties"}`}
								</Text>
							</Pressable>
						) : null}
						<View style={styles.body}>
							{note.body === null ? null : blocks.length > 0 ? (
								<RowNoteBody blocks={blocks} onToggleTask={note.toggleTask} />
							) : (
								<Text style={[styles.placeholder, { color: colors.tertiaryLabel }]}>
									Start writing in the editor.
								</Text>
							)}
						</View>
						<Text style={[styles.footer, { color: colors.tertiaryLabel }]}>
							{`Edited ${formatEditedAgo(row.mtime)} · ${backlinks} ${backlinks === 1 ? "backlink" : "backlinks"}`}
						</Text>
					</>
				) : (
					<EmptyState
						description={
							model.registryReady ? "This note is no longer in the database." : undefined
						}
						title={model.registryReady ? "Note not found" : "Loading…"}
					/>
				)}
			</ScrollView>
			<Stack.Screen
				options={{
					headerRight: IS_IOS
						? undefined
						: () => (
								<NativeMenu
									accessibilityLabel="Note actions"
									groups={moreGroups}
									icon={{ md: "more_vert", sf: "ellipsis" }}
								/>
							),
					title: databaseName,
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Menu accessibilityLabel="Note actions" icon="ellipsis" title={title}>
						{moreGroups.flat().map((item) => (
							<Stack.Toolbar.MenuAction icon={item.icon?.sf} key={item.key} onPress={item.onPress}>
								{item.label}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				</Stack.Toolbar>
			) : null}
			{row && ordered.length > 0 ? (
				<RowPager
					filePath={filePath}
					index={Math.max(index, 0)}
					onStep={step}
					total={ordered.length}
				/>
			) : null}
			{statusDefinition ? (
				<StatusPicker
					message={title}
					onPresentedChange={setStatusOpen}
					onSelect={selectStatus}
					options={statusOptions}
					presented={statusOpen}
					title={statusDefinition.name}
					value={statusValue === undefined ? undefined : String(statusValue)}
				/>
			) : null}
		</>
	)
}

const styles = StyleSheet.create({
	androidBar: {
		alignItems: "center",
		bottom: 28,
		flexDirection: "row",
		gap: 8,
		left: 16,
		position: "absolute",
		right: 16,
	},
	androidFab: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 20,
		elevation: 3,
		height: 64,
		justifyContent: "center",
		width: 64,
	},
	androidIcon: {
		alignItems: "center",
		height: 48,
		justifyContent: "center",
		width: 48,
	},
	androidPager: {
		alignItems: "center",
		borderRadius: 999,
		flex: 1,
		flexDirection: "row",
		height: 64,
		paddingHorizontal: 8,
	},
	androidPosition: {
		fontSize: 14,
		letterSpacing: 0.25,
		lineHeight: 20,
		marginLeft: 8,
	},
	body: {
		marginTop: 14,
	},
	content: {
		paddingBottom: 140,
		paddingHorizontal: 20,
	},
	footer: {
		fontSize: 13,
		lineHeight: 18,
		marginTop: 24,
	},
	h1: {
		fontSize: 28,
		fontWeight: "700",
		lineHeight: 34,
		marginBottom: 12,
		marginTop: 8,
	},
	inline: {
		alignItems: "center",
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 6,
	},
	placeholder: {
		fontSize: 17,
		lineHeight: 24,
	},
	positionPill: {
		alignItems: "center",
		height: 36,
		justifyContent: "center",
		width: 76,
	},
	positionText: {
		fontSize: 15,
		fontVariant: ["tabular-nums"],
		lineHeight: 20,
	},
	propKey: {
		alignItems: "center",
		flexDirection: "row",
		gap: 6,
		width: 112,
	},
	propKeyText: {
		flexShrink: 1,
		fontSize: 14,
		fontWeight: "500",
		lineHeight: 18,
	},
	propRow: {
		alignItems: "center",
		flexDirection: "row",
		minHeight: 44,
		paddingHorizontal: 10,
	},
	propValue: {
		flex: 1,
		minWidth: 0,
	},
	propsAdd: {
		height: 44,
		justifyContent: "center",
		paddingHorizontal: 10,
	},
	propsAddText: {
		fontSize: 15,
		lineHeight: 20,
	},
	propsBox: {
		borderCurve: "continuous",
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 4,
		paddingVertical: 2,
	},
	tag: {
		borderRadius: 999,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	tagText: {
		fontSize: 13,
		lineHeight: 18,
	},
	valueText: {
		fontSize: 15,
		lineHeight: 20,
	},
})
