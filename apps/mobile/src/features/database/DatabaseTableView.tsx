import { getPropertyValueList } from "@cortex/properties"
import {
	DATABASE_NO_VALUE_GROUP,
	type DatabaseGroup,
	type DatabaseRow,
	getPropertyBaseType,
} from "@cortex/properties/database"
import { useState } from "react"
import {
	Animated,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native"

import { SymbolIcon } from "@/components/ui/Symbol"
import { Avatar } from "@/components/ui/Avatar"
import { DatabaseCellValue, OptionPill } from "@/features/database/DatabaseCells"
import { columnWidth, firstName, resolvePersonName } from "@/features/database/databaseFormat"
import { DatabaseRowMenu } from "@/features/database/DatabaseRowMenu"
import type { DatabaseViewModel } from "@/features/database/useDatabaseView"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"
const NAME_WIDTH = 172
const ROW_HEIGHT = 48
const HEADER_HEIGHT = 36

export interface DatabaseCollectionProps {
	collapsed: ReadonlySet<string>
	highlighted: ReadonlySet<string>
	model: DatabaseViewModel
	onCreate: (group: DatabaseGroup | null) => void
	onOpenRow: (row: DatabaseRow) => void
	onToggleGroup: (key: string) => void
}

export function visibleGroups(model: DatabaseViewModel): DatabaseGroup[] {
	const groups = model.result?.groups ?? []
	const groupKey = model.activeView?.group
	const excluded = new Set(
		(model.activeView?.filters ?? [])
			.filter((filter) => filter.key === groupKey && filter.op === "is_not")
			.flatMap((filter) => getPropertyValueList(filter.value).map(String)),
	)
	return groups.filter(
		(group) =>
			group.rows.length > 0 ||
			(group.key !== DATABASE_NO_VALUE_GROUP && !excluded.has(String(group.value))),
	)
}

export function GroupLabel({ group, model }: { group: DatabaseGroup; model: DatabaseViewModel }) {
	const { colors } = useMobileColors()
	const groupKey = model.activeView?.group
	const definition = groupKey ? model.resolved.byKey.get(groupKey) : undefined
	if (group.option) return <OptionPill option={group.option} />
	if (definition && getPropertyBaseType(definition) === "person" && group.value !== undefined) {
		const name = resolvePersonName(group.value, model.authorConfig)
		return (
			<View style={styles.groupPerson}>
				<Avatar name={name} size={18} />
				<Text style={[styles.groupLabel, { color: colors.label }]}>{firstName(name)}</Text>
			</View>
		)
	}
	return (
		<Text style={[styles.groupLabel, { color: colors.label }]}>{group.label || "All notes"}</Text>
	)
}

export function DatabaseTableView({
	collapsed,
	highlighted,
	model,
	onCreate,
	onOpenRow,
	onToggleGroup,
}: DatabaseCollectionProps) {
	const { colors } = useMobileColors()
	const { width: windowWidth } = useWindowDimensions()
	const [scrollX] = useState(() => new Animated.Value(0))
	const columns = model.columns
	const widths = columns.map((definition) => columnWidth(definition, model.roles))
	const tableWidth = Math.max(
		windowWidth,
		NAME_WIDTH + widths.reduce((sum, width) => sum + width, 0),
	)
	const sort = model.activeView?.sort?.[0]
	const grouped = Boolean(
		model.activeView?.group && model.resolved.byKey.has(model.activeView.group),
	)
	const groups = visibleGroups(model)
	const sticky = { transform: [{ translateX: scrollX }] }
	const stickyWidth = { width: windowWidth }

	return (
		<Animated.ScrollView
			horizontal
			onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
				useNativeDriver: true,
			})}
			scrollEventThrottle={16}
			showsHorizontalScrollIndicator={false}
		>
			<View accessibilityLabel={model.entry?.name} style={{ width: tableWidth }}>
				<View
					style={[
						styles.row,
						styles.header,
						{ backgroundColor: colors.background, borderBottomColor: colors.separator },
					]}
				>
					<Animated.View
						style={[
							styles.nameCell,
							sticky,
							{ backgroundColor: colors.background, height: HEADER_HEIGHT },
						]}
					>
						<Text style={[styles.headerText, { color: colors.secondaryLabel }]}>Name</Text>
					</Animated.View>
					{columns.map((definition, index) => {
						const sorted = sort?.key === definition.key
						return (
							<Pressable
								accessibilityLabel={`Sort by ${definition.name}`}
								accessibilityRole="button"
								key={definition.key}
								onPress={() => {
									triggerSelectionHaptic()
									model.cycleSort(definition.key)
								}}
								style={[styles.cell, { height: HEADER_HEIGHT, width: widths[index] }]}
							>
								<Text
									numberOfLines={1}
									style={[
										styles.headerText,
										{ color: sorted ? colors.tint : colors.secondaryLabel },
									]}
								>
									{sorted
										? `${definition.name} ${sort?.dir === "desc" ? "↓" : "↑"}`
										: definition.name}
								</Text>
							</Pressable>
						)
					})}
				</View>
				{groups.map((group) => {
					const isCollapsed = collapsed.has(group.key)
					return (
						<View key={group.key}>
							{grouped ? (
								<Animated.View style={[sticky, stickyWidth]}>
									<Pressable
										accessibilityRole="button"
										accessibilityState={{ expanded: !isCollapsed }}
										onPress={() => {
											triggerSelectionHaptic()
											onToggleGroup(group.key)
										}}
										style={[styles.groupHeader, { backgroundColor: colors.background }]}
									>
										<SymbolIcon
											color={colors.secondaryLabel}
											name={
												isCollapsed
													? { md: "chevron_right", sf: "chevron.right" }
													: { md: "expand_more", sf: "chevron.down" }
											}
											size={13}
										/>
										<GroupLabel group={group} model={model} />
										<Text style={[styles.groupCount, { color: colors.secondaryLabel }]}>
											{group.rows.length}
										</Text>
									</Pressable>
								</Animated.View>
							) : null}
							{isCollapsed
								? null
								: group.rows.map((row) => {
										const rowBackground = highlighted.has(row.path)
											? colors.accentSubtle
											: colors.background
										return (
											<DatabaseRowMenu key={row.path} onOpenRow={onOpenRow} row={row}>
												{(handlers) => (
													<Pressable
														accessibilityRole="button"
														android_ripple={{ color: colors.hover }}
														onLongPress={handlers.onLongPress}
														onPress={handlers.onPress}
														style={[
															styles.row,
															{
																backgroundColor: rowBackground,
																borderBottomColor: colors.separator,
															},
														]}
													>
														<Animated.View
															style={[styles.nameCell, sticky, { backgroundColor: rowBackground }]}
														>
															<Text
																numberOfLines={1}
																style={[styles.nameText, { color: colors.label }]}
															>
																{row.title}
															</Text>
														</Animated.View>
														{columns.map((definition, index) => (
															<View
																key={definition.key}
																style={[styles.cell, { width: widths[index] }]}
															>
																<DatabaseCellValue
																	definition={definition}
																	model={model}
																	row={row}
																/>
															</View>
														))}
													</Pressable>
												)}
											</DatabaseRowMenu>
										)
									})}
							<Animated.View style={[sticky, stickyWidth]}>
								<Pressable
									accessibilityLabel={`New note${group.label ? ` in ${group.label}` : ""}`}
									accessibilityRole="button"
									onPress={() => onCreate(grouped ? group : null)}
									style={({ pressed }) => [styles.addRow, { opacity: pressed ? 0.5 : 1 }]}
								>
									<SymbolIcon
										color={colors.secondaryLabel}
										name={{ md: "add", sf: "plus" }}
										size={16}
									/>
									<Text style={[styles.addLabel, { color: colors.secondaryLabel }]}>New</Text>
								</Pressable>
							</Animated.View>
						</View>
					)
				})}
			</View>
		</Animated.ScrollView>
	)
}

const styles = StyleSheet.create({
	addLabel: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
	},
	addRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		height: 44,
		paddingLeft: 20,
	},
	cell: {
		height: ROW_HEIGHT,
		justifyContent: "center",
		paddingHorizontal: 10,
	},
	groupCount: {
		fontSize: 13,
		fontVariant: ["tabular-nums"],
		lineHeight: 18,
	},
	groupHeader: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		height: 44,
		paddingHorizontal: 20,
	},
	groupLabel: {
		fontSize: IS_IOS ? 15 : 14,
		fontWeight: "600",
		lineHeight: 20,
	},
	groupPerson: {
		alignItems: "center",
		flexDirection: "row",
		gap: 6,
	},
	header: {
		height: HEADER_HEIGHT,
	},
	headerText: {
		fontSize: 13,
		fontWeight: "600",
		lineHeight: 18,
	},
	nameCell: {
		height: ROW_HEIGHT,
		justifyContent: "center",
		paddingLeft: 20,
		paddingRight: 10,
		width: NAME_WIDTH,
		zIndex: 1,
	},
	nameText: {
		fontSize: IS_IOS ? 17 : 16,
		fontWeight: "500",
		lineHeight: 22,
	},
	row: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
	},
})
