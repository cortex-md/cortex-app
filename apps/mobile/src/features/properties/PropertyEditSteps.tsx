import {
	changePropertyType,
	createPropertyDefinition,
	type PropertyDefinition,
	removePropertyOption,
	supportsMultipleValues,
	updatePropertyOption,
} from "@cortex/properties"
import { Host, Switch } from "@expo/ui"
import { ChevronDown } from "lucide-react-native"
import { useState } from "react"
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native"

import {
	GroupedFooter,
	GroupedList,
	GroupedRow,
	GroupedSectionHeader,
} from "@/components/ui/GroupedList"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SearchField } from "@/components/ui/SearchField"
import { toast } from "@/features/feedback/useToast"
import {
	AUTOMATIC_CREATABLE,
	AUTOMATIC_TYPES,
	COLOR_SWATCHES,
	CREATABLE_TYPES,
	type CreatableType,
	getTypeLabel,
	stepForDefinition,
	swatchColor,
} from "@/features/properties/propertyPresentation"
import type { PropertyStepProps } from "@/features/properties/propertyStepTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

function NameField({
	label,
	onCommit,
	value,
}: {
	label: string
	onCommit: (value: string) => void
	value: string
}) {
	const { colors } = useMobileColors()
	const [draft, setDraft] = useState(value)
	return (
		<View style={styles.nameRow}>
			<Text style={[styles.nameLabel, { color: colors.secondaryLabel }]}>{label}</Text>
			<TextInput
				accessibilityLabel={label}
				onChangeText={setDraft}
				onEndEditing={() => {
					const trimmed = draft.trim()
					if (trimmed && trimmed !== value) onCommit(trimmed)
				}}
				returnKeyType="done"
				style={[styles.nameInput, { color: colors.label }]}
				value={draft}
			/>
		</View>
	)
}

function ToggleRow({
	label,
	onChange,
	value,
}: {
	label: string
	onChange: (value: boolean) => void
	value: boolean
}) {
	return (
		<GroupedRow
			title={label}
			trailing={
				<Host matchContents>
					<Switch label={label} onValueChange={onChange} value={value} />
				</Host>
			}
		/>
	)
}

function TypeTile({ item, onPress }: { item: CreatableType; onPress: () => void }) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			accessibilityRole="button"
			android_ripple={{ color: colors.hover }}
			onPress={onPress}
			style={({ pressed }) => [
				styles.tile,
				{ backgroundColor: pressed && IS_IOS ? colors.hover : colors.cell },
			]}
		>
			<Text numberOfLines={1} style={[styles.tileLabel, { color: colors.label }]}>
				{item.label}
			</Text>
		</Pressable>
	)
}

export function PropertyAddStep({ properties, push, pop, route }: PropertyStepProps) {
	const [query, setQuery] = useState(route.query ?? "")
	const normalized = query.trim().toLocaleLowerCase()
	const onNote = new Set([...Object.keys(properties.persistedMeta), ...properties.revealedKeys])
	const suggestions = properties.schema.properties.filter(
		(definition) =>
			!onNote.has(definition.key) &&
			!AUTOMATIC_TYPES.has(definition.type) &&
			definition.key !== "database" &&
			(!normalized || definition.name.toLocaleLowerCase().includes(normalized)),
	)
	const createName = query.trim() || "Property"

	function addExisting(definition: PropertyDefinition) {
		properties.reveal(definition.key)
		toast(`Added ${definition.name} to this note`)
		const step = stepForDefinition(definition)
		if (step === "values") pop()
		else push({ step, key: definition.key })
	}

	async function createProperty(type: string) {
		const definition = createPropertyDefinition({
			name: createName,
			type,
			properties: properties.schema.properties,
		})
		if (!(await properties.saveDefinition(definition))) return
		properties.reveal(definition.key)
		push({ step: AUTOMATIC_TYPES.has(type) ? "auto" : "settings", key: definition.key })
	}

	return (
		<>
			<View style={styles.search}>
				<SearchField
					autoFocus
					onChangeText={setQuery}
					onClear={() => setQuery("")}
					placeholder="Property name"
					value={query}
				/>
			</View>
			{suggestions.length > 0 ? (
				<>
					<GroupedSectionHeader>In this vault</GroupedSectionHeader>
					<GroupedList>
						{suggestions.map((definition) => {
							const usage = properties.usageFor(definition.key).notes
							return (
								<GroupedRow
									key={definition.key}
									onPress={() => addExisting(definition)}
									subtitle={`${getTypeLabel(definition.type)} · ${usage} ${usage === 1 ? "note" : "notes"}`}
									title={definition.name}
								/>
							)
						})}
					</GroupedList>
				</>
			) : null}
			<GroupedSectionHeader>{`Create "${createName}" as`}</GroupedSectionHeader>
			<View style={styles.grid}>
				{CREATABLE_TYPES.map((item) => (
					<TypeTile item={item} key={item.type} onPress={() => void createProperty(item.type)} />
				))}
			</View>
			<GroupedSectionHeader>Automatic</GroupedSectionHeader>
			<GroupedList>
				{AUTOMATIC_CREATABLE.map((item) => (
					<GroupedRow
						key={item.type}
						onPress={() => void createProperty(item.type)}
						title={item.label}
					/>
				))}
			</GroupedList>
		</>
	)
}

export function PropertySettingsStep({ definition, pop, properties }: PropertyStepProps) {
	const { colors } = useMobileColors()
	if (!definition) return null
	const usage = properties.usageFor(definition.key).notes
	const typeGroups = [
		CREATABLE_TYPES.map((item) => ({
			key: item.type,
			label: item.label,
			checked: item.type === definition.type,
			onPress: () => void properties.saveDefinition(changePropertyType(definition, item.type)),
		})),
	]

	return (
		<>
			<GroupedList>
				<NameField
					key={definition.name}
					label="Name"
					onCommit={(name) => void properties.saveDefinition({ ...definition, name })}
					value={definition.name}
				/>
				<GroupedRow
					title="Type"
					trailing={
						<View style={styles.typeTrailing}>
							<Text style={[styles.typeValue, { color: colors.secondaryLabel }]}>
								{getTypeLabel(definition.type)}
							</Text>
							<NativeMenu
								accessibilityLabel="Property type"
								groups={typeGroups}
								icon={{ sf: "chevron.up.chevron.down", Lucide: ChevronDown }}
							/>
						</View>
					}
				/>
				{supportsMultipleValues(definition.type) ? (
					<ToggleRow
						label="Allow multiple values"
						onChange={(multiple) => void properties.saveDefinition({ ...definition, multiple })}
						value={definition.multiple === true}
					/>
				) : null}
				<ToggleRow
					label="Hide when empty"
					onChange={(hideWhenEmpty) => void properties.saveDefinition({ ...definition, hideWhenEmpty })}
					value={definition.hideWhenEmpty === true}
				/>
			</GroupedList>
			<GroupedFooter>
				{`The name and type belong to the vault. Renaming "${definition.name}" renames it in all ${usage} ${usage === 1 ? "note" : "notes"}.`}
			</GroupedFooter>
			<View style={styles.spacer} />
			<GroupedList>
				<GroupedRow
					destructive
					onPress={() => {
						void properties.removeValue(definition).then((removed) => {
							if (removed) pop()
						})
					}}
					title="Remove from this note"
				/>
			</GroupedList>
		</>
	)
}

export function PropertyOptionStep({ definition, pop, properties, route }: PropertyStepProps) {
	const { colors } = useMobileColors()
	const option = definition?.options?.find((candidate) => candidate.id === route.optionId)
	if (!definition || !option) return null
	const used = properties.usageFor(definition.key).values[option.id] ?? 0

	function update(updates: { label?: string; color?: (typeof COLOR_SWATCHES)[number]["color"] }) {
		if (!definition || !option) return
		void properties.saveDefinition(updatePropertyOption(definition, option.id, updates))
	}

	return (
		<>
			<GroupedList>
				<NameField
					key={option.label}
					label="Name"
					onCommit={(label) => update({ label })}
					value={option.label}
				/>
			</GroupedList>
			<GroupedSectionHeader>Colour</GroupedSectionHeader>
			<View style={[styles.swatches, { backgroundColor: colors.cell }]}>
				{COLOR_SWATCHES.map((swatch) => {
					const selected = swatch.color === option.color
					return (
						<Pressable
							accessibilityLabel={swatch.label}
							accessibilityRole="button"
							accessibilityState={{ selected }}
							key={swatch.color}
							onPress={() => update({ color: swatch.color })}
							style={[
								styles.swatchRing,
								{ borderColor: selected ? swatchColor(swatch.color, colors) : "transparent" },
							]}
						>
							<View
								style={[
									styles.swatch,
									{
										backgroundColor: swatchColor(swatch.color, colors),
										borderColor: selected ? colors.cell : "transparent",
									},
								]}
							/>
						</Pressable>
					)
				})}
			</View>
			<GroupedFooter>{`Used in ${used} ${used === 1 ? "note" : "notes"}`}</GroupedFooter>
			<View style={styles.spacer} />
			<GroupedList>
				<GroupedRow
					destructive
					onPress={() => {
						void properties
							.saveDefinition(removePropertyOption(definition, option.id))
							.then((saved) => {
								if (saved) pop()
							})
					}}
					title="Delete option"
				/>
			</GroupedList>
		</>
	)
}

const styles = StyleSheet.create({
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginHorizontal: 16,
	},
	nameInput: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: 22,
		padding: 0,
		textAlign: IS_IOS ? "right" : "left",
	},
	nameLabel: {
		fontSize: IS_IOS ? 17 : 14,
		lineHeight: 22,
	},
	nameRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: IS_IOS ? 52 : 56,
		paddingHorizontal: 16,
	},
	search: {
		paddingTop: 8,
	},
	spacer: {
		height: 16,
	},
	swatch: {
		borderRadius: 999,
		borderWidth: 2,
		height: 30,
		width: 30,
	},
	swatchRing: {
		alignItems: "center",
		borderRadius: 999,
		borderWidth: 2,
		height: 38,
		justifyContent: "center",
		width: 38,
	},
	swatches: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginHorizontal: 16,
		padding: 14,
	},
	tile: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 18,
		height: 56,
		justifyContent: "center",
		overflow: "hidden",
		width: "31.5%",
	},
	tileLabel: {
		fontSize: 15,
		fontWeight: "500",
		lineHeight: 20,
	},
	typeTrailing: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
	},
	typeValue: {
		fontSize: IS_IOS ? 17 : 14,
		lineHeight: 22,
	},
})
