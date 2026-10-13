import { useLocalSearchParams } from "expo-router"
import { Check, ChevronLeft, X } from "lucide-react-native"
import { useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { dismissSheet } from "@/features/navigation/routes"
import { useSheetFilePath } from "@/features/note/noteSheetParams"
import {
	PropertyAddStep,
	PropertyOptionStep,
	PropertySettingsStep,
} from "@/features/properties/PropertyEditSteps"
import {
	PropertyDateStep,
	PropertyPersonStep,
	PropertySelectStep,
} from "@/features/properties/PropertyPickerSteps"
import { type PropertyStep, stepForDefinition } from "@/features/properties/propertyPresentation"
import type { PropertyRoute, PropertyStepProps } from "@/features/properties/propertyStepTypes"
import { PropertyAutoStep, PropertyValuesStep } from "@/features/properties/PropertyValuesStep"
import { useNoteProperties } from "@/features/properties/useNoteProperties"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const KNOWN_STEPS = new Set<PropertyStep>([
	"values",
	"add",
	"settings",
	"select",
	"option",
	"person",
	"date",
	"auto",
])

function param(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value
}

function stepTitle(route: PropertyRoute, definitionName: string | undefined): string {
	switch (route.step) {
		case "add":
			return "Add property"
		case "settings":
			return "Property settings"
		case "option":
			return "Edit option"
		case "select":
		case "person":
		case "date":
			return definitionName ?? "Property"
		default:
			return "Properties"
	}
}

function PropertiesHeader({
	nested,
	onBack,
	title,
}: {
	nested: boolean
	onBack: () => void
	title: string
}) {
	const { colors } = useMobileColors()
	const LeadingIcon = nested ? ChevronLeft : X
	if (!IS_IOS) {
		return (
			<View style={styles.m3Header}>
				{nested ? (
					<Pressable accessibilityLabel="Back" hitSlop={8} onPress={onBack} style={styles.m3Button}>
						<ChevronLeft color={colors.label} size={24} strokeWidth={2} />
					</Pressable>
				) : null}
				<Text numberOfLines={1} style={[styles.m3Title, { color: colors.label }]}>
					{title}
				</Text>
				<Pressable accessibilityLabel="Close" hitSlop={8} onPress={dismissSheet} style={styles.m3Button}>
					<X color={colors.secondaryLabel} size={24} strokeWidth={2} />
				</Pressable>
			</View>
		)
	}
	return (
		<View style={styles.header}>
			<Pressable
				accessibilityLabel={nested ? "Back" : "Close"}
				onPress={nested ? onBack : dismissSheet}
				style={[styles.round, { backgroundColor: colors.fill }]}
			>
				<LeadingIcon color={colors.label} size={20} strokeWidth={2.2} />
			</Pressable>
			<Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
				{title}
			</Text>
			<Pressable
				accessibilityLabel="Done"
				onPress={dismissSheet}
				style={[styles.round, { backgroundColor: colors.tintFill }]}
			>
				<Check color={colors.onTint} size={20} strokeWidth={2.6} />
			</Pressable>
		</View>
	)
}

function StepContent(props: PropertyStepProps) {
	switch (props.route.step) {
		case "add":
			return <PropertyAddStep {...props} />
		case "settings":
			return <PropertySettingsStep {...props} />
		case "select":
			return <PropertySelectStep {...props} />
		case "option":
			return <PropertyOptionStep {...props} />
		case "person":
			return <PropertyPersonStep {...props} />
		case "date":
			return <PropertyDateStep {...props} />
		case "auto":
			return <PropertyAutoStep {...props} />
		default:
			return <PropertyValuesStep {...props} />
	}
}

export function PropertiesSheet() {
	const { colors } = useMobileColors()
	const params = useLocalSearchParams<{ step?: string | string[]; key?: string | string[] }>()
	const filePath = useSheetFilePath()
	const properties = useNoteProperties(filePath)
	const initialStep = param(params.step)
	const initialKey = param(params.key)
	const [stack, setStack] = useState<PropertyRoute[]>(() => {
		const step = initialStep && KNOWN_STEPS.has(initialStep as PropertyStep) ? (initialStep as PropertyStep) : "values"
		return step === "values" ? [{ step }] : [{ step: "values" }, { step, key: initialKey }]
	})
	const [resolvedKey, setResolvedKey] = useState<string | null>(null)
	const definitionForKey = properties.findDefinition(initialKey)
	if (initialKey && definitionForKey && resolvedKey !== initialKey && stack.length === 1) {
		setResolvedKey(initialKey)
		const step = stepForDefinition(definitionForKey)
		if (step !== "values") setStack([{ step: "values" }, { step, key: initialKey }])
	}
	const route = stack[stack.length - 1]
	const definition = properties.findDefinition(route.key)

	function push(next: PropertyRoute) {
		setStack((current) => [...current, next])
	}

	function pop() {
		setStack((current) => (current.length > 1 ? current.slice(0, -1) : current))
	}

	return (
		<KeyboardAvoidingView
			behavior={IS_IOS ? "padding" : undefined}
			style={[styles.root, { backgroundColor: colors.groupedBackground }]}
		>
			<PropertiesHeader
				nested={stack.length > 1}
				onBack={pop}
				title={stepTitle(route, definition?.name)}
			/>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardDismissMode="interactive"
				keyboardShouldPersistTaps="handled"
			>
				<StepContent
					definition={definition}
					key={`${route.step}:${route.key ?? ""}:${route.optionId ?? ""}`}
					pop={pop}
					properties={properties}
					push={push}
					route={route}
				/>
			</ScrollView>
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 48,
	},
	header: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: 60,
		paddingHorizontal: 14,
		paddingVertical: 8,
	},
	m3Button: {
		alignItems: "center",
		height: 48,
		justifyContent: "center",
		width: 48,
	},
	m3Header: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	m3Title: {
		flex: 1,
		fontSize: 22,
		lineHeight: 28,
		paddingLeft: 12,
	},
	root: {
		flex: 1,
	},
	round: {
		alignItems: "center",
		borderRadius: 999,
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	title: {
		flex: 1,
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
		textAlign: "center",
	},
})
