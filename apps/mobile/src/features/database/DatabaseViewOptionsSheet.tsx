import type { DatabaseSort, DatabaseView } from "@cortex/properties/database"
import { Stack, useLocalSearchParams } from "expo-router"

import { FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
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
} from "@/features/database/databaseFormat"
import { readParam } from "@/features/database/databaseNavigation"
import { type DatabaseViewModel, useDatabaseView } from "@/features/database/useDatabaseView"
import { FormChoiceRow } from "@/features/importExport/FormFields"
import { HeaderActions } from "@/features/importExport/HeaderActions"
import { dismissSheet } from "@/features/navigation/routes"
import { triggerSelectionHaptic } from "@/utils/haptics"

const TAB_TITLES: Record<ViewOptionsTab, string> = {
	filter: "Filter",
	group: "Group by",
	props: "Properties",
	sort: "Sort by",
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
		<FormSection title="Show notes where">
			{rows.map((filter) => {
				const label = describeFilter(filter, model.resolved, model.authorConfig)
				return (
					<FormToggle
						key={`${filter.key}-${filter.op}-${JSON.stringify(filter.value)}`}
						onValueChange={(on) => {
							triggerSelectionHaptic()
							model.updateView((current) => setFilter(current, filter, on))
						}}
						title={`${label.property} ${label.operator}${label.value ? ` ${label.value}` : ""}`}
						value={hasFilter(view, filter)}
					/>
				)
			})}
		</FormSection>
	)
}

function Hint({ text }: { text: string }) {
	return <FormSection footer={text}>{null}</FormSection>
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
		<FormSection>
			{options.map((option) => (
				<FormChoiceRow
					key={option.key}
					onPress={() => {
						triggerSelectionHaptic()
						model.updateView((view) => ({ ...view, sort: option.sort ? [option.sort] : undefined }))
					}}
					selected={isSelected(option.sort)}
					title={option.label}
				/>
			))}
		</FormSection>
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
		<FormSection>
			{groupableProperties(model.resolved).map((definition) => (
				<FormChoiceRow
					key={definition.key}
					onPress={() => pick(definition.key)}
					selected={current === definition.key}
					title={definition.name}
				/>
			))}
			<FormChoiceRow onPress={() => pick(undefined)} selected={!grouped} title="No grouping" />
		</FormSection>
	)
}

function toggleColumn(
	view: DatabaseView,
	allKeys: string[],
	key: string,
	on: boolean,
): DatabaseView {
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
		<FormSection title={`Shown in ${view?.type ?? "table"}`}>
			{model.resolved.properties.map((definition) => (
				<FormToggle
					key={definition.key}
					onValueChange={(on) => {
						triggerSelectionHaptic()
						model.updateView((current) => toggleColumn(current, allKeys, definition.key, on))
					}}
					title={definition.name}
					value={shown.has(definition.key)}
				/>
			))}
		</FormSection>
	)
}

export function DatabaseViewOptionsSheet() {
	const params = useLocalSearchParams<{
		folderPath?: string | string[]
		tab?: string | string[]
		viewId?: string | string[]
	}>()
	const folderPath = readParam(params.folderPath) ?? ""
	const model = useDatabaseView(folderPath, readParam(params.viewId))
	const requested = readParam(params.tab)
	const tab = VIEW_OPTIONS_TABS.find((option) => option.value === requested)?.value ?? "filter"

	return (
		<>
			<Stack.Screen options={{ title: TAB_TITLES[tab] }} />
			<HeaderActions right={{ label: "Done", onPress: dismissSheet, primary: true }} />
			<NativeForm>
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
			</NativeForm>
		</>
	)
}
