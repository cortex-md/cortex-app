import {
	createPropertyOption,
	getPropertyValueList,
	getSortedPropertyOptions,
	parsePropertyDate,
	serializePropertyDate,
	togglePropertyValue,
} from "@cortex/properties"
import { Host, Switch } from "@expo/ui"
import { Check, Ellipsis, Square, SquareCheck, X } from "lucide-react-native"
import { useState } from "react"
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import {
	GroupedFooter,
	GroupedList,
	GroupedRow,
	GroupedSectionHeader,
} from "@/components/ui/GroupedList"
import { MiniCalendar } from "@/components/ui/MiniCalendar"
import { SearchField } from "@/components/ui/SearchField"
import { StatusPill } from "@/components/ui/StatusPill"
import { getCollabVaultName, listVaultMembers } from "@/features/collab/collabAdapter"
import { toast } from "@/features/feedback/useToast"
import { formatDate, optionTone } from "@/features/properties/propertyPresentation"
import type { PropertyStepProps } from "@/features/properties/propertyStepTypes"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const DEFAULT_TIME = "09:00"

export function PropertySelectStep({ definition, properties, push }: PropertyStepProps) {
	const { colors } = useMobileColors()
	const [draft, setDraft] = useState("")
	if (!definition) return null
	const options = getSortedPropertyOptions(definition)
	const current = properties.persistedMeta[definition.key]
	const selectedIds = new Set(getPropertyValueList(current).map(String))
	const normalized = draft.trim().toLocaleLowerCase()
	const filtered = normalized
		? options.filter((option) => option.label.toLocaleLowerCase().includes(normalized))
		: options
	const exact = options.some((option) => option.label.toLocaleLowerCase() === normalized)
	const usage = properties.usageFor(definition.key).notes

	function toggle(optionId: string) {
		if (!definition) return
		void properties.setValue(definition, togglePropertyValue(definition, current, optionId))
	}

	async function createOption() {
		if (!definition) return
		const label = draft.trim()
		const option = createPropertyOption(label, definition.options)
		const next = { ...definition, options: [...(definition.options ?? []), option] }
		if (!(await properties.saveDefinition(next))) return
		await properties.setValue(next, togglePropertyValue(next, current, option.id))
		toast(`${label} added to ${definition.name}`)
		setDraft("")
	}

	return (
		<>
			<View style={[styles.tokenField, { backgroundColor: colors.cell }]}>
				<View style={styles.tokens}>
					{options
						.filter((option) => selectedIds.has(option.id))
						.map((option) => (
							<Pressable
								accessibilityLabel={`Remove ${option.label}`}
								key={option.id}
								onPress={() => toggle(option.id)}
								style={styles.token}
							>
								<StatusPill label={option.label} tone={optionTone(option.color)} />
								<X color={colors.secondaryLabel} size={14} strokeWidth={2.4} />
							</Pressable>
						))}
				</View>
				<TextInput
					accessibilityLabel="Select an option or create one"
					autoFocus={options.length === 0}
					onChangeText={setDraft}
					onSubmitEditing={() => {
						if (draft.trim() && !exact) void createOption()
					}}
					placeholder="Select an option or create one"
					placeholderTextColor={colors.secondaryLabel}
					returnKeyType="done"
					style={[styles.tokenInput, { color: colors.label }]}
					value={draft}
				/>
			</View>
			<View style={styles.spacer} />
			<GroupedList>
				{draft.trim() && !exact ? (
					<GroupedRow
						onPress={() => void createOption()}
						tint
						title={`+ Create "${draft.trim()}"`}
					/>
				) : null}
				{filtered.map((option) => (
					<GroupedRow
						key={option.id}
						leading={<StatusPill label={option.label} tone={optionTone(option.color)} />}
						onPress={() => toggle(option.id)}
						title=""
						trailing={
							<View style={styles.optionTrailing}>
								{selectedIds.has(option.id) ? (
									<Check color={colors.tint} size={18} strokeWidth={2.6} />
								) : null}
								<Pressable
									accessibilityLabel={`Edit ${option.label}`}
									hitSlop={8}
									onPress={() => push({ step: "option", key: definition.key, optionId: option.id })}
								>
									<Ellipsis color={colors.secondaryLabel} size={20} strokeWidth={2.2} />
								</Pressable>
							</View>
						}
					/>
				))}
			</GroupedList>
			<GroupedFooter>
				{`${options.length} ${options.length === 1 ? "option" : "options"} · shared by ${usage} ${usage === 1 ? "note" : "notes"} using ${definition.name}. New options get the next colour.`}
			</GroupedFooter>
		</>
	)
}

export function PropertyPersonStep({ definition, properties }: PropertyStepProps) {
	const { colors } = useMobileColors()
	const [query, setQuery] = useState("")
	if (!definition) return null
	const authorConfig = properties.authorConfig
	const people =
		authorConfig.variant === "person"
			? authorConfig.options.map((person) => ({
					id: person.id,
					name: person.label,
					email: person.email ?? "",
				}))
			: listVaultMembers().map((person) => ({ id: person.id, name: person.name, email: person.email }))
	const current = properties.persistedMeta[definition.key]
	const selected = new Set(getPropertyValueList(current).map(String))
	const normalized = query.trim().toLocaleLowerCase()
	const visible = normalized
		? people.filter(
				(person) =>
					person.name.toLocaleLowerCase().includes(normalized) ||
					person.email.toLocaleLowerCase().includes(normalized),
			)
		: people
	const multiple = { ...definition, multiple: true }

	return (
		<>
			<View style={styles.search}>
				<SearchField
					onChangeText={setQuery}
					onClear={() => setQuery("")}
					placeholder="Search people in this vault"
					value={query}
				/>
			</View>
			<GroupedSectionHeader>{`Members of ${getCollabVaultName()}`}</GroupedSectionHeader>
			<GroupedList>
				{visible.map((person) => {
					const checked = selected.has(person.id)
					const CheckIcon = checked ? SquareCheck : Square
					return (
						<GroupedRow
							key={person.id}
							leading={<Avatar name={person.name} size={36} />}
							onPress={() =>
								void properties.setValue(definition, togglePropertyValue(multiple, current, person.id))
							}
							subtitle={person.email}
							title={person.name}
							trailing={
								<CheckIcon
									color={checked ? colors.tint : colors.tertiaryLabel}
									size={22}
									strokeWidth={2.2}
								/>
							}
						/>
					)
				})}
			</GroupedList>
			<GroupedFooter>People come from the vault members. You can pick more than one.</GroupedFooter>
		</>
	)
}

export function PropertyDateStep({ definition, pop, properties }: PropertyStepProps) {
	const { colors } = useMobileColors()
	const value = definition ? properties.persistedMeta[definition.key] : undefined
	const selectedDate = parsePropertyDate(value)
	const today = serializePropertyDate(new Date())
	const selected = selectedDate ? serializePropertyDate(selectedDate) : undefined
	const [month, setMonth] = useState(() => selected ?? today)
	const [includeTime, setIncludeTime] = useState(false)
	if (!definition) return null

	return (
		<>
			<GroupedList>
				<GroupedRow title="Date" value={formatDate(value) ?? "Empty"} />
			</GroupedList>
			<View style={styles.spacer} />
			<View style={[styles.calendar, { backgroundColor: colors.cell }]}>
				<MiniCalendar
					month={month}
					onChangeMonth={setMonth}
					onSelectDate={(date) => void properties.setValue(definition, date)}
					selected={selected}
					today={today}
					weekStart="sunday"
				/>
			</View>
			<View style={styles.spacer} />
			<GroupedList>
				<GroupedRow
					title="Include time"
					trailing={
						<Host matchContents>
							<Switch label="Include time" onValueChange={setIncludeTime} value={includeTime} />
						</Host>
					}
				/>
				{includeTime ? <GroupedRow title="Time" value={DEFAULT_TIME} /> : null}
			</GroupedList>
			<View style={styles.spacer} />
			<GroupedList>
				<GroupedRow
					destructive
					onPress={() => {
						void properties.removeValue(definition).then((removed) => {
							if (removed) pop()
						})
					}}
					title="Clear"
				/>
			</GroupedList>
		</>
	)
}

const styles = StyleSheet.create({
	calendar: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		marginHorizontal: 16,
		padding: 8,
	},
	optionTrailing: {
		alignItems: "center",
		flexDirection: "row",
		gap: 14,
	},
	search: {
		paddingTop: 8,
	},
	spacer: {
		height: 16,
	},
	token: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
	},
	tokenField: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		gap: 8,
		marginHorizontal: 16,
		marginTop: 8,
		padding: 14,
	},
	tokenInput: {
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: 22,
		padding: 0,
	},
	tokens: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
})
