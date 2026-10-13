import { getBaseName } from "@cortex/core"
import type { DatabaseSort, DatabaseView } from "@cortex/properties/database"
import { FieldGroup, Host } from "@expo/ui"
import { useLocalSearchParams } from "expo-router"
import { Check } from "lucide-react-native"
import { type ReactNode, useState } from "react"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { SettingsRow } from "@/components/ui/SettingsRow"
import { SheetHeader } from "@/components/ui/SheetHeader"
import {
	describeFilter,
	groupableProperties,
	hasFilter,
	hideDoneFilter,
	mineFilter,
	propertyName,
	sameFilter,
	setFilter,
	sortableDateProperty,
	VIEW_OPTIONS_TABS,
	type ViewOptionsTab,
	viewTitle,
} from "@/features/database/databaseFormat"
import { readParam } from "@/features/database/databaseNavigation"
import { type DatabaseViewModel, useDatabaseView } from "@/features/database/useDatabaseView"
import { dismissSheet } from "@/features/navigation/routes"
import { useMobileColors } from "@/hooks/useMobileColors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"

function RadioMark({ selected }: { selected: boolean }) {
	const { colors } = useMobileColors()
	if (IS_IOS) {
		return selected ? <Check color={colors.tint} size={20} strokeWidth={2.4} /> : null
	}
	return (
		<View style={[styles.radio, { borderColor: selected ? colors.tintFill : colors.secondaryLabel }]}>
			{selected ? <View style={[styles.radioDot, { backgroundColor: colors.tintFill }]} /> : null}
		</View>
	)
}

function OptionsSection({ children, title }: { children: ReactNode; title: string }) {
	return (
		<Host matchContents style={styles.host}>
			<FieldGroup>
				<FieldGroup.Section title={title}>{children}</FieldGroup.Section>
			</FieldGroup>
		</Host>
	)
}

function FilterTab({ model }: { model: DatabaseViewModel }) {
	const view = model.activeView
	const presets = [hideDoneFilter(model.roles), mineFilter(model.roles)].filter(
		(filter): filter is NonNullable<typeof filter> => filter !== null,
	)
	const others = (view?.filters ?? []).filter(
		(filter) => !presets.some((preset) => sameFilter(preset, filter)),
	)
	const rows = [...presets, ...others]
	if (rows.length === 0) {
		return <Hint text="Add a status or person property to filter this view." />
	}
	return (
		<OptionsSection title="Show notes where">
			{rows.map((filter) => {
				const label = describeFilter(filter, model.resolved, model.authorConfig)
				return (
					<SettingsRow
						key={`${filter.key}-${filter.op}-${JSON.stringify(filter.value)}`}
						onToggle={(on) => {
							triggerSelectionHaptic()
							model.updateView((current) => setFilter(current, filter, on))
						}}
						title={`${label.property} ${label.operator}${label.value ? ` ${label.value}` : ""}`}
						toggled={hasFilter(view, filter)}
					/>
				)
			})}
		</OptionsSection>
	)
}

function Hint({ text }: { text: string }) {
	const { colors } = useMobileColors()
	return <Text style={[styles.hint, { color: colors.secondaryLabel }]}>{text}</Text>
}

function SortTab({ model }: { model: DatabaseViewModel }) {
	const current = model.activeView?.sort?.[0]
	const date = sortableDateProperty(model.resolved, model.roles)
	const options: { key: string; label: string; sort: DatabaseSort | undefined }[] = []
	if (date) {
		options.push(
			{ key: "asc", label: `${date.name}, soonest first`, sort: { dir: "asc", key: date.key } },
			{ key: "desc", label: `${date.name}, latest first`, sort: { dir: "desc", key: date.key } },
		)
	}
	if (current && current.key !== date?.key) {
		options.push({
			key: "current",
			label: `${propertyName(current.key, model.resolved)} ${current.dir === "desc" ? "↓" : "↑"}`,
			sort: current,
		})
	}
	options.push({ key: "manual", label: "Manual", sort: undefined })
	const isSelected = (sort: DatabaseSort | undefined) =>
		sort ? current?.key === sort.key && current.dir === sort.dir : !current

	return (
		<OptionsSection title="Sort by">
			{options.map((option) => (
				<SettingsRow
					key={option.key}
					onPress={() => {
						triggerSelectionHaptic()
						model.updateView((view) => ({ ...view, sort: option.sort ? [option.sort] : undefined }))
					}}
					title={option.label}
					trailing={<RadioMark selected={isSelected(option.sort)} />}
				/>
			))}
		</OptionsSection>
	)
}

function GroupTab({ model }: { model: DatabaseViewModel }) {
	const current = model.activeView?.group
	const grouped = Boolean(current && model.resolved.byKey.has(current))
	const pick = (group: string | undefined) => {
		triggerSelectionHaptic()
		model.updateView((view) => ({ ...view, group }))
	}
	return (
		<OptionsSection title="Group by">
			{groupableProperties(model.resolved).map((definition) => (
				<SettingsRow
					key={definition.key}
					onPress={() => pick(definition.key)}
					title={definition.name}
					trailing={<RadioMark selected={current === definition.key} />}
				/>
			))}
			<SettingsRow
				onPress={() => pick(undefined)}
				title="No grouping"
				trailing={<RadioMark selected={!grouped} />}
			/>
		</OptionsSection>
	)
}

function toggleColumn(view: DatabaseView, allKeys: string[], key: string, on: boolean): DatabaseView {
	const shown = new Set(view.columns ?? allKeys)
	if (on) shown.add(key)
	else shown.delete(key)
	return { ...view, columns: allKeys.filter((item) => shown.has(item)) }
}

function PropertiesTab({ model }: { model: DatabaseViewModel }) {
	const view = model.activeView
	const allKeys = model.resolved.properties.map((definition) => definition.key)
	const shown = new Set(view?.columns ?? allKeys)
	if (allKeys.length === 0) {
		return <Hint text="This database has no properties yet. Add one from any row." />
	}
	return (
		<OptionsSection title={IS_IOS ? `Shown in ${view?.type ?? "table"}` : "Properties"}>
			{model.resolved.properties.map((definition) => (
				<SettingsRow
					key={definition.key}
					onToggle={(on) => {
						triggerSelectionHaptic()
						model.updateView((current) => toggleColumn(current, allKeys, definition.key, on))
					}}
					title={definition.name}
					toggled={shown.has(definition.key)}
				/>
			))}
		</OptionsSection>
	)
}

export function DatabaseViewOptionsSheet() {
	const params = useLocalSearchParams<{
		folderPath?: string | string[]
		tab?: string | string[]
		viewId?: string | string[]
	}>()
	const { colors } = useMobileColors()
	const folderPath = readParam(params.folderPath) ?? ""
	const model = useDatabaseView(folderPath, readParam(params.viewId))
	const [tab, setTab] = useState<ViewOptionsTab>(() => {
		const requested = readParam(params.tab)
		return VIEW_OPTIONS_TABS.find((option) => option.value === requested)?.value ?? "filter"
	})
	const viewNoteName = model.entry
		? getBaseName(model.entry.viewNotePath)
		: `${getBaseName(folderPath)}.md`

	return (
		<ScrollView
			contentContainerStyle={styles.content}
			style={{ backgroundColor: colors.groupedBackground }}
		>
			<SheetHeader
				onClose={IS_IOS ? undefined : dismissSheet}
				onDone={IS_IOS ? dismissSheet : undefined}
				title={viewTitle(model.activeView?.type)}
			/>
			<SegmentedControl
				accessibilityLabel="Options"
				onChange={(value: ViewOptionsTab) => {
					triggerSelectionHaptic()
					setTab(value)
				}}
				options={VIEW_OPTIONS_TABS}
				style={styles.segmented}
				value={tab}
			/>
			{model.activeView ? (
				tab === "filter" ? (
					<FilterTab model={model} />
				) : tab === "sort" ? (
					<SortTab model={model} />
				) : tab === "group" ? (
					<GroupTab model={model} />
				) : (
					<PropertiesTab model={model} />
				)
			) : (
				<Hint text="This database is still loading." />
			)}
			<Text style={[styles.footer, { color: colors.secondaryLabel }]}>
				{"Saved to the "}
				<Text style={styles.code}>database</Text>
				{` block in ${viewNoteName}`}
			</Text>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	code: {
		fontFamily: IS_IOS ? "Menlo" : "monospace",
	},
	content: {
		paddingBottom: 32,
	},
	footer: {
		fontSize: IS_IOS ? 13 : 12,
		letterSpacing: IS_IOS ? 0 : 0.4,
		lineHeight: IS_IOS ? 18 : 16,
		marginHorizontal: 32,
		marginTop: 10,
	},
	hint: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
		marginHorizontal: 32,
		marginTop: 16,
	},
	host: {
		marginTop: 8,
	},
	radio: {
		alignItems: "center",
		borderRadius: 999,
		borderWidth: 2,
		height: 20,
		justifyContent: "center",
		width: 20,
	},
	radioDot: {
		borderRadius: 999,
		height: 10,
		width: 10,
	},
	segmented: {
		marginBottom: 6,
		marginHorizontal: 16,
	},
})
