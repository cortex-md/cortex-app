import {
	getPropertyValueList,
	isEmptyPropertyValue,
	type PropertyDefinition,
	resolvePropertyOption,
} from "@cortex/properties"
import { useState, useSyncExternalStore } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { SymbolIcon, type SymbolName } from "@/components/ui/Symbol"
import {
	formatPropertyValue,
	getBaseType,
	getPropertyTags,
	getTypeIcon,
	routeForDefinition,
} from "@/features/properties/propertyPresentation"
import { presentPropertyRoute } from "@/features/properties/propertyRoutes"
import type { NoteProperties } from "@/features/properties/useNoteProperties"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"
import { triggerSelectionHaptic } from "@/utils/haptics"

const IS_IOS = Platform.OS === "ios"
const PREVIEW_ROWS = 4
const MAX_CAPSULES = 3
const CHECKED_ICON: SymbolName = { sf: "checkmark.circle.fill", md: "check_circle" }
const UNCHECKED_ICON: SymbolName = { sf: "circle", md: "radio_button_unchecked" }
const ADD_ICON: SymbolName = { sf: "plus", md: "add" }

let collapsed = false
const collapseListeners = new Set<() => void>()

function subscribeCollapsed(listener: () => void): () => void {
	collapseListeners.add(listener)
	return () => {
		collapseListeners.delete(listener)
	}
}

function getCollapsed(): boolean {
	return collapsed
}

function toggleCollapsed(): void {
	collapsed = !collapsed
	for (const listener of collapseListeners) listener()
}

interface Capsule {
	key: string
	label: string
}

function capsulesFor(definition: PropertyDefinition, value: unknown): Capsule[] | null {
	const baseType = getBaseType(definition)
	if (baseType === "tags") {
		return getPropertyTags(value).map((tag) => ({ key: tag, label: `#${tag}` }))
	}
	if (baseType === "select") {
		return getPropertyValueList(value).map((item) => ({
			key: String(item),
			label: resolvePropertyOption(definition, item).label,
		}))
	}
	return null
}

function Capsules({
	capsules,
	colors,
	tag,
}: {
	capsules: Capsule[]
	colors: MobileColors
	tag: boolean
}) {
	const shown = capsules.slice(0, MAX_CAPSULES)
	const hidden = capsules.length - shown.length
	const background = tag ? colors.tagBackground : colors.accentSubtle
	const foreground = tag ? colors.tagText : colors.tint
	return (
		<View style={styles.capsules}>
			{shown.map((capsule) => (
				<View key={capsule.key} style={[styles.capsule, { backgroundColor: background }]}>
					<Text numberOfLines={1} style={[styles.capsuleText, { color: foreground }]}>
						{capsule.label}
					</Text>
				</View>
			))}
			{hidden > 0 ? (
				<Text style={[styles.capsuleMore, { color: colors.secondaryLabel }]}>+{hidden}</Text>
			) : null}
		</View>
	)
}

function PropertyValue({
	colors,
	definition,
	value,
}: {
	colors: MobileColors
	definition: PropertyDefinition
	value: unknown
}) {
	if (getBaseType(definition) === "checkbox") {
		return (
			<SymbolIcon
				color={value === true ? colors.tint : colors.tertiaryLabel}
				name={value === true ? CHECKED_ICON : UNCHECKED_ICON}
				size={18}
			/>
		)
	}
	if (isEmptyPropertyValue(value)) {
		return (
			<Text numberOfLines={1} style={[styles.value, { color: colors.tertiaryLabel }]}>
				Empty
			</Text>
		)
	}
	const capsules = capsulesFor(definition, value)
	if (capsules && capsules.length > 0) {
		return <Capsules capsules={capsules} colors={colors} tag={getBaseType(definition) === "tags"} />
	}
	return (
		<Text numberOfLines={1} style={[styles.value, { color: colors.label }]}>
			{formatPropertyValue(definition, value)}
		</Text>
	)
}

function openProperty(properties: NoteProperties, definition: PropertyDefinition): void {
	const filePath = properties.filePath
	if (!filePath) return
	const route = routeForDefinition(definition)
	if (route) {
		presentPropertyRoute(filePath, route, { key: definition.key })
		return
	}
	triggerSelectionHaptic()
	void properties.setValue(definition, properties.resolvedMeta[definition.key] !== true)
}

function PropertyRow({
	colors,
	definition,
	properties,
}: {
	colors: MobileColors
	definition: PropertyDefinition
	properties: NoteProperties
}) {
	const value = properties.resolvedMeta[definition.key]
	return (
		<Pressable
			accessibilityHint={routeForDefinition(definition) ? "Edits the value" : "Toggles the value"}
			accessibilityLabel={`${definition.name}, ${formatPropertyValue(definition, value)}`}
			accessibilityRole="button"
			android_ripple={{ color: colors.hover }}
			onPress={() => openProperty(properties, definition)}
			style={({ pressed }) => [styles.row, pressed && IS_IOS ? styles.pressed : null]}
		>
			<View style={styles.name}>
				<SymbolIcon color={colors.secondaryLabel} name={getTypeIcon(definition.type)} size={15} />
				<Text numberOfLines={1} style={[styles.nameText, { color: colors.secondaryLabel }]}>
					{definition.name}
				</Text>
			</View>
			<View style={styles.valueFrame}>
				<PropertyValue colors={colors} definition={definition} value={value} />
			</View>
		</Pressable>
	)
}

export function NotePropertiesBlock({
	definitions,
	properties,
}: {
	definitions: PropertyDefinition[]
	properties: NoteProperties
}) {
	const { colors } = useMobileColors()
	const isCollapsed = useSyncExternalStore(subscribeCollapsed, getCollapsed, getCollapsed)
	const [expandedPath, setExpandedPath] = useState<string | null>(null)
	const filePath = properties.filePath
	if (!filePath || definitions.length === 0) return null
	const expanded = expandedPath === filePath
	const truncated = !expanded && definitions.length > PREVIEW_ROWS + 1
	const rows = truncated ? definitions.slice(0, PREVIEW_ROWS) : definitions

	return (
		<View style={[styles.block, { borderBottomColor: colors.separator }]}>
			<Pressable
				accessibilityLabel={`Properties, ${definitions.length}`}
				accessibilityRole="button"
				accessibilityState={{ expanded: !isCollapsed }}
				hitSlop={4}
				onPress={() => {
					triggerSelectionHaptic()
					toggleCollapsed()
				}}
				style={styles.header}
			>
				<Text style={[styles.headerText, { color: colors.secondaryLabel }]}>
					{isCollapsed ? `Properties · ${definitions.length}` : "Properties"}
				</Text>
				<SymbolIcon
					color={colors.tertiaryLabel}
					name={
						isCollapsed
							? { sf: "chevron.right", md: "chevron_right" }
							: { sf: "chevron.down", md: "expand_more" }
					}
					size={11}
				/>
			</Pressable>
			{isCollapsed ? null : (
				<>
					{rows.map((definition) => (
						<PropertyRow
							colors={colors}
							definition={definition}
							key={definition.id}
							properties={properties}
						/>
					))}
					<View style={styles.footer}>
						<Pressable
							accessibilityRole="button"
							hitSlop={6}
							onPress={() => presentPropertyRoute(filePath, "add")}
							style={styles.footerButton}
						>
							<SymbolIcon color={colors.tint} name={ADD_ICON} size={14} />
							<Text style={[styles.footerText, { color: colors.tint }]}>Add property</Text>
						</Pressable>
						{definitions.length > PREVIEW_ROWS + 1 ? (
							<Pressable
								accessibilityRole="button"
								hitSlop={6}
								onPress={() => setExpandedPath(expanded ? null : filePath)}
								style={styles.footerButton}
							>
								<Text style={[styles.footerText, { color: colors.tint }]}>
									{expanded ? "Show less" : `Show all (${definitions.length})`}
								</Text>
							</Pressable>
						) : null}
					</View>
				</>
			)}
		</View>
	)
}

const ROW_FONT = IS_IOS ? 15 : 14
const INSET = 16

const styles = StyleSheet.create({
	block: {
		borderBottomWidth: StyleSheet.hairlineWidth,
		marginHorizontal: INSET,
		paddingBottom: 6,
	},
	capsule: {
		borderRadius: 11,
		flexShrink: 1,
		justifyContent: "center",
		minHeight: 22,
		paddingHorizontal: 8,
	},
	capsuleMore: {
		fontSize: 13,
		fontVariant: ["tabular-nums"],
	},
	capsuleText: {
		fontSize: 13,
		fontWeight: "500",
	},
	capsules: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
		justifyContent: "flex-end",
		overflow: "hidden",
	},
	footer: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		minHeight: 32,
	},
	footerButton: {
		alignItems: "center",
		flexDirection: "row",
		gap: 6,
		minHeight: 32,
	},
	footerText: {
		fontSize: ROW_FONT,
		fontWeight: "500",
	},
	header: {
		alignItems: "center",
		alignSelf: "flex-start",
		flexDirection: "row",
		gap: 6,
		minHeight: 30,
	},
	headerText: {
		fontSize: 13,
		fontWeight: "600",
	},
	name: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		maxWidth: "45%",
	},
	nameText: {
		flexShrink: 1,
		fontSize: ROW_FONT,
	},
	pressed: {
		opacity: 0.5,
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: 32,
	},
	value: {
		fontSize: ROW_FONT,
		textAlign: "right",
	},
	valueFrame: {
		alignItems: "flex-end",
		flex: 1,
		minWidth: 0,
	},
})
