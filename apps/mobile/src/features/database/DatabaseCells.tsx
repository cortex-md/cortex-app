import {
	getPropertyValueList,
	isEmptyPropertyValue,
	type PropertyDefinition,
	type PropertyOption,
	resolvePropertyOption,
} from "@cortex/properties"
import { type DatabaseRow, getPropertyBaseType } from "@cortex/properties/database"
import { Platform, StyleSheet, Text, View } from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import { StatusPill } from "@/components/ui/StatusPill"
import {
	type DueTone,
	firstName,
	formatPropertyValue,
	formatRelativeDue,
	isRowDone,
	optionTone,
	resolvePersonName,
} from "@/features/database/databaseFormat"
import type { DatabaseViewModel } from "@/features/database/useDatabaseView"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"

export function dueToneColor(tone: DueTone, colors: MobileColors): string {
	switch (tone) {
		case "over":
			return colors.destructiveText
		case "soon":
			return colors.tint
		case "muted":
			return colors.tertiaryLabel
		default:
			return colors.secondaryLabel
	}
}

export function OptionPill({ option }: { option: PropertyOption }) {
	return <StatusPill label={option.label} tone={optionTone(option.color)} />
}

export function rowStatusOption(row: DatabaseRow, model: DatabaseViewModel): PropertyOption | null {
	const key = model.roles.statusKey
	const definition = key ? model.resolved.byKey.get(key) : undefined
	const value = key ? getPropertyValueList(row.meta[key])[0] : undefined
	if (!definition || value === undefined) return null
	return resolvePropertyOption(definition, value)
}

export function rowOwnerName(row: DatabaseRow, model: DatabaseViewModel): string | null {
	const key = model.roles.ownerKey
	const value = key ? getPropertyValueList(row.meta[key])[0] : undefined
	return value === undefined ? null : resolvePersonName(value, model.authorConfig)
}

export function PersonLabel({
	name,
	showName = true,
	size = 22,
}: {
	name: string
	showName?: boolean
	size?: 18 | 22 | 24 | 26
}) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.person}>
			<Avatar name={name} size={size} />
			{showName ? (
				<Text numberOfLines={1} style={[styles.cellText, { color: colors.label }]}>
					{firstName(name)}
				</Text>
			) : null}
		</View>
	)
}

export function RowDue({
	model,
	row,
	small = false,
}: {
	model: DatabaseViewModel
	row: DatabaseRow
	small?: boolean
}) {
	const { colors } = useMobileColors()
	const key = model.roles.dateKey
	if (!key) return null
	const due = formatRelativeDue(
		row.meta[key],
		model.queryContext.today,
		isRowDone(row, model.roles),
	)
	return (
		<Text
			numberOfLines={1}
			style={[
				small ? styles.smallText : styles.cellText,
				{ color: dueToneColor(due.tone, colors) },
			]}
		>
			{due.label}
		</Text>
	)
}

export function DatabaseCellValue({
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
		const due = formatRelativeDue(value, model.queryContext.today, isRowDone(row, model.roles))
		return (
			<Text numberOfLines={1} style={[styles.cellText, { color: dueToneColor(due.tone, colors) }]}>
				{due.label}
			</Text>
		)
	}
	if (isEmptyPropertyValue(value)) {
		return <Text style={[styles.cellText, { color: colors.tertiaryLabel }]}>—</Text>
	}
	if (baseType === "select" && definition.key === model.roles.statusKey) {
		return <OptionPill option={resolvePropertyOption(definition, getPropertyValueList(value)[0])} />
	}
	if (baseType === "person") {
		return (
			<PersonLabel name={resolvePersonName(getPropertyValueList(value)[0], model.authorConfig)} />
		)
	}
	const muted = baseType === "tags"
	return (
		<Text
			numberOfLines={1}
			style={[styles.cellText, { color: muted ? colors.tertiaryLabel : colors.label }]}
		>
			{formatPropertyValue(definition, value, model.authorConfig)}
		</Text>
	)
}

const styles = StyleSheet.create({
	cellText: {
		flexShrink: 1,
		fontSize: IS_IOS ? 15 : 14,
		letterSpacing: IS_IOS ? 0 : 0.25,
		lineHeight: 20,
	},
	person: {
		alignItems: "center",
		flexDirection: "row",
		flexShrink: 1,
		gap: 6,
	},
	smallText: {
		fontSize: 13,
		lineHeight: 18,
	},
})
