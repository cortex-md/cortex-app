import type { DatabaseView, DatabaseViewType } from "@cortex/properties/database"
import { useState } from "react"
import { Alert, ScrollView, StyleSheet, View } from "react-native"

import { FilterChip } from "@/components/ui/FilterChip"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import type { SymbolName } from "@/components/ui/Symbol"
import { TextPromptDialog } from "@/components/ui/TextPromptDialog"
import { DATABASE_VIEW_OPTIONS } from "@/features/database/databaseFormat"
import type { DatabaseViewModel } from "@/features/database/useDatabaseView"
import { triggerSelectionHaptic } from "@/utils/haptics"

const VIEW_ICONS: Record<DatabaseViewType, SymbolName> = {
	board: { md: "view_kanban", sf: "rectangle.split.3x1" },
	calendar: { md: "calendar_month", sf: "calendar" },
	gallery: { md: "grid_view", sf: "square.grid.2x2" },
	table: { md: "table", sf: "tablecells" },
}

function confirmDeleteView(view: DatabaseView, onConfirm: () => void): void {
	Alert.alert(`Delete “${view.name}”?`, "The notes in this database are not affected.", [
		{ style: "cancel", text: "Cancel" },
		{ onPress: onConfirm, style: "destructive", text: "Delete view" },
	])
}

function buildViewGroups(
	model: DatabaseViewModel,
	view: DatabaseView,
	onRename: () => void,
): MenuGroup[] {
	const lastView = (model.config?.views.length ?? 0) <= 1
	return [
		DATABASE_VIEW_OPTIONS.map((option) => ({
			icon: VIEW_ICONS[option.value],
			key: `new-${option.value}`,
			label: `New ${option.label.toLowerCase()} view`,
			onPress: () => {
				triggerSelectionHaptic()
				model.addView(option.value)
			},
		})),
		[
			{
				icon: { md: "edit", sf: "pencil" },
				key: "rename",
				label: "Rename…",
				onPress: onRename,
			},
			{
				icon: { md: "content_copy", sf: "plus.square.on.square" },
				key: "duplicate",
				label: "Duplicate",
				onPress: () => model.duplicateView(view),
			},
		],
		[
			{
				destructive: true,
				disabled: lastView,
				icon: { md: "delete", sf: "trash" },
				key: "delete",
				label: "Delete view",
				onPress: () => confirmDeleteView(view, () => model.removeView(view)),
			},
		],
	]
}

export function DatabaseViewBar({ model }: { model: DatabaseViewModel }) {
	const [renaming, setRenaming] = useState(false)
	const views = model.config?.views ?? []
	const active = model.activeView
	if (!active) return null

	return (
		<View style={styles.bar}>
			<ScrollView
				accessibilityLabel="Views"
				contentContainerStyle={styles.chips}
				horizontal
				showsHorizontalScrollIndicator={false}
				style={styles.scroll}
			>
				{views.map((view) => (
					<FilterChip
						key={view.id}
						label={view.name}
						onPress={() => {
							triggerSelectionHaptic()
							model.selectView(view.id)
						}}
						selected={view.id === active.id}
					/>
				))}
			</ScrollView>
			<NativeMenu
				accessibilityLabel="View actions"
				anchorStyle="plain"
				groups={buildViewGroups(model, active, () => setRenaming(true))}
				header={active.name}
				icon={{ md: "more_horiz", sf: "ellipsis.circle" }}
			/>
			<TextPromptDialog
				confirmLabel="Rename"
				initialValue={active.name}
				onCancel={() => setRenaming(false)}
				onConfirm={(name) => {
					setRenaming(false)
					if (name !== active.name) model.renameView(active, name)
				}}
				placeholder="View name"
				title="Rename view"
				visible={renaming}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	bar: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
		paddingRight: 12,
	},
	chips: {
		gap: 8,
		paddingHorizontal: 16,
		paddingVertical: 6,
	},
	scroll: {
		flex: 1,
	},
})
