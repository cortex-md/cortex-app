import { getPlatform } from "@cortex/platform"
import {
	getVisiblePropertyDefinitions,
	isResolvedPropertyActor,
	type PropertyDefinition,
	resolveTextPropertyDraft,
} from "@cortex/properties"
import { Host, Switch } from "@expo/ui"
import { Lock } from "lucide-react-native"
import { useState } from "react"
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import {
	GroupedFooter,
	GroupedList,
	GroupedRow,
	GroupedSectionHeader,
} from "@/components/ui/GroupedList"
import { toast } from "@/features/feedback/useToast"
import {
	AUTOMATIC_TYPES,
	formatDate,
	formatPropertyValue,
	getBaseType,
	stepForDefinition,
} from "@/features/properties/propertyPresentation"
import type { PropertyStepProps } from "@/features/properties/propertyStepTypes"
import type { NoteProperties } from "@/features/properties/useNoteProperties"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const TEXT_TYPES = new Set(["text", "number", "url", "email", "phone", "tags"])

function draftFromValue(value: unknown): string {
	if (value === undefined || value === null) return ""
	if (Array.isArray(value)) return value.map(String).join(", ")
	return String(value)
}

function TextValueRow({
	definition,
	onLongPress,
	properties,
	value,
}: {
	definition: PropertyDefinition
	onLongPress: () => void
	properties: NoteProperties
	value: unknown
}) {
	const { colors } = useMobileColors()
	const [draft, setDraft] = useState(() => draftFromValue(value))
	const [error, setError] = useState<string | null>(null)
	const baseType = getBaseType(definition)

	function commit() {
		if (draft === draftFromValue(value)) return
		if (baseType === "tags") {
			const tags = draft
				.split(",")
				.map((tag) => tag.trim().replace(/^#/, ""))
				.filter(Boolean)
			void properties.setValue(definition, tags)
			return
		}
		const resolution = resolveTextPropertyDraft(definition.type, draft)
		if (resolution.kind === "invalid") {
			setError(resolution.message)
			return
		}
		setError(null)
		if (resolution.kind === "remove") void properties.removeValue(definition)
		else void properties.setValue(definition, resolution.value)
	}

	return (
		<Pressable onLongPress={onLongPress} style={styles.textRow}>
			<View style={styles.textRowMain}>
				<Text numberOfLines={1} style={[styles.key, { color: colors.secondaryLabel }]}>
					{definition.name}
				</Text>
				<TextInput
					accessibilityLabel={definition.name}
					autoCapitalize="none"
					autoCorrect={baseType === "text"}
					keyboardType={
						baseType === "number"
							? "decimal-pad"
							: baseType === "email"
								? "email-address"
								: baseType === "phone"
									? "phone-pad"
									: baseType === "url"
										? "url"
										: "default"
					}
					onChangeText={(next) => {
						setDraft(next)
						setError(null)
					}}
					onEndEditing={commit}
					placeholder="Empty"
					placeholderTextColor={colors.tertiaryLabel}
					returnKeyType="done"
					style={[styles.valueInput, { color: colors.label }]}
					value={draft}
				/>
				{baseType === "url" && draft ? (
					<Pressable
						accessibilityRole="button"
						hitSlop={6}
						onPress={() => {
							void getPlatform()
								.clipboard.writeText(draft)
								.then(() => toast("Copied link"))
						}}
					>
						<Text style={[styles.copy, { color: colors.tint }]}>Copy</Text>
					</Pressable>
				) : null}
			</View>
			{error ? <Text style={[styles.error, { color: colors.destructiveText }]}>{error}</Text> : null}
		</Pressable>
	)
}

export function PropertyValuesStep({ properties, push }: PropertyStepProps) {
	const definitionsById = new Map(
		properties.schema.properties.map((definition) => [definition.key, definition.id]),
	)
	const revealedIds = new Set(
		[...properties.revealedKeys].flatMap((key) => {
			const id = definitionsById.get(key)
			return id ? [id] : []
		}),
	)
	const definitions = getVisiblePropertyDefinitions({
		properties: properties.schema.properties,
		persistedMeta: properties.persistedMeta,
		resolvedMeta: properties.resolvedMeta,
		revealedDefinitionIds: revealedIds,
	}).filter((definition) => !AUTOMATIC_TYPES.has(definition.type))

	return (
		<>
			<GroupedSectionHeader>This note</GroupedSectionHeader>
			<GroupedList>
				{definitions.map((definition) => {
					const value = properties.resolvedMeta[definition.key]
					const baseType = getBaseType(definition)
					const openSettings = () => push({ step: "settings", key: definition.key })
					if (TEXT_TYPES.has(baseType)) {
						return (
							<TextValueRow
								definition={definition}
								key={`${definition.key}:${draftFromValue(value)}`}
								onLongPress={openSettings}
								properties={properties}
								value={value}
							/>
						)
					}
					if (baseType === "checkbox") {
						return (
							<GroupedRow
								key={definition.key}
								onLongPress={openSettings}
								title={definition.name}
								trailing={
									<Host matchContents>
										<Switch
											label={definition.name}
											onValueChange={(next) => void properties.setValue(definition, next)}
											value={value === true}
										/>
									</Host>
								}
							/>
						)
					}
					return (
						<GroupedRow
							chevron
							key={definition.key}
							onLongPress={openSettings}
							onPress={() => push({ step: stepForDefinition(definition), key: definition.key })}
							title={definition.name}
							value={formatPropertyValue(definition, value)}
						/>
					)
				})}
				<GroupedRow onPress={() => push({ step: "add" })} tint title="+ Add property" />
			</GroupedList>
			<GroupedFooter>
				Tap to edit, Return to finish. Links show open and copy; invalid values keep the error until
				fixed.
			</GroupedFooter>
			<View style={styles.spacer} />
			<GroupedList>
				<GroupedRow chevron onPress={() => push({ step: "auto" })} tint title="Automatic properties" />
			</GroupedList>
		</>
	)
}

export function PropertyAutoStep({ properties }: PropertyStepProps) {
	const { colors } = useMobileColors()
	const automatic = properties.schema.properties.filter((definition) =>
		AUTOMATIC_TYPES.has(definition.type),
	)
	const lock = <Lock color={colors.tertiaryLabel} size={16} strokeWidth={2.2} />

	return (
		<>
			<GroupedSectionHeader>Set by Cortex</GroupedSectionHeader>
			<GroupedList>
				{automatic.length === 0 ? (
					<GroupedRow subtitle="Add Created time, Created by or Last edited time." title="No automatic properties" />
				) : (
					automatic.map((definition) => {
						const value = properties.resolvedMeta[definition.key]
						const actor = isResolvedPropertyActor(value) ? value : null
						return (
							<GroupedRow
								key={definition.key}
								leading={lock}
								title={definition.name}
								trailing={
									actor ? (
										<View style={styles.actor}>
											<Avatar name={actor.label} size={22} />
											<Text style={[styles.actorLabel, { color: colors.secondaryLabel }]}>{actor.label}</Text>
										</View>
									) : null
								}
								value={actor ? undefined : (formatDate(value) ?? formatPropertyValue(definition, value))}
							/>
						)
					})
				)}
			</GroupedList>
			<GroupedFooter>
				Read-only. Long-press a row to see the exact value or remove the property from this note.
			</GroupedFooter>
		</>
	)
}

const styles = StyleSheet.create({
	actor: {
		alignItems: "center",
		flexDirection: "row",
		gap: 6,
	},
	actorLabel: {
		fontSize: 15,
		lineHeight: 20,
	},
	copy: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	error: {
		fontSize: 13,
		lineHeight: 18,
		paddingLeft: 124,
	},
	key: {
		fontSize: 14,
		fontWeight: "500",
		lineHeight: 18,
		width: 112,
	},
	spacer: {
		height: 16,
	},
	textRow: {
		gap: 4,
		justifyContent: "center",
		minHeight: IS_IOS ? 52 : 56,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	textRowMain: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
	},
	valueInput: {
		flex: 1,
		fontSize: 15,
		lineHeight: 20,
		minWidth: 0,
		padding: 0,
	},
})
