import {
	getErrorMessage,
	openNoteDocumentSession,
	type TemplateDefinition,
	type TemplateVault,
	useTemplateStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { parseFrontmatter } from "@cortex/properties"
import {
	getTemplateValueGroups,
	getTemplateValueLabel,
	splitTemplateSegments,
} from "@cortex/templates"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import MarkdownBlock from "@/components/ui/MarkdownBlock"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { NoteEditorScreen } from "@/features/editor/NoteEditorScreen"
import { useMobileEditorThemeTokens } from "@/features/editor/editorTheme"
import { toast } from "@/features/feedback/useToast"
import { presentSheet } from "@/features/navigation/routes"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import { PropertiesBox } from "@/features/templates/TemplateFields"
import { openTemplateSettings } from "@/features/templates/TemplateSettingsScreen"
import {
	createTemplateContext,
	getTemplateBodyFilePath,
	useVaultTemplates,
} from "@/features/templates/templatesAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

type DisplayMode = "preview" | "source"

const MODE_OPTIONS: { label: string; value: DisplayMode }[] = [
	{ label: "Preview", value: "preview" },
	{ label: "Source", value: "source" },
]

const PLACEHOLDER_EXPRESSIONS = ["date.today", "date.week", "note.title", "vault.name"]

const PLACEHOLDER_INSERTS: Record<string, string> = {
	"note.title": "note.title | title",
}

function readParam(value: string | string[] | undefined): string | null {
	const resolved = Array.isArray(value) ? value[0] : value
	return resolved ? resolved : null
}

async function copyPlaceholder(expression: string): Promise<void> {
	const text = `{{ ${PLACEHOLDER_INSERTS[expression] ?? expression} }}`
	try {
		await getPlatform().clipboard.writeText(text)
		toast(`Copied ${text} — paste it in the template`)
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

function useTemplateFileContent(filePath: string | null, enabled: boolean): string | null {
	const [content, setContent] = useState<{ filePath: string; raw: string } | null>(null)

	useEffect(() => {
		if (!filePath || !enabled) return
		const session = openNoteDocumentSession(filePath, {
			onChange: () => {
				queueMicrotask(() => {
					const raw = session.getRawContent()
					if (raw !== null) setContent({ filePath, raw })
				})
			},
			onError: (error) => toast(getErrorMessage(error)),
		})
		return () => session.dispose()
	}, [enabled, filePath])

	return content?.filePath === filePath ? content.raw : null
}

function replacePlaceholders(source: string): string {
	return splitTemplateSegments(source)
		.map((segment) =>
			segment.kind === "text" ? segment.value : `\`${getTemplateValueLabel(segment.value)}\``,
		)
		.join("")
}

function PlaceholderBar({ examples }: { examples: Record<string, string> }) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.placeholderBar}>
			<Text style={[styles.placeholderLabel, { color: colors.secondaryLabel }]}>Placeholders</Text>
			<ScrollView
				contentContainerStyle={styles.placeholderChips}
				horizontal
				keyboardShouldPersistTaps="always"
				showsHorizontalScrollIndicator={false}
			>
				{PLACEHOLDER_EXPRESSIONS.map((expression, index) => (
					<Pressable
						accessibilityHint="Copies the placeholder so you can paste it in the template"
						accessibilityLabel={`Insert ${expression}`}
						accessibilityRole="button"
						key={expression}
						onPress={() => void copyPlaceholder(expression)}
						style={({ pressed }) => [
							styles.placeholderChip,
							{
								backgroundColor: index === 0 ? colors.accentSubtle : colors.fill,
								opacity: pressed ? 0.7 : 1,
							},
						]}
					>
						<Text style={[styles.placeholderCode, { color: colors.headingBlue }]}>
							{expression}
						</Text>
						<Text style={[styles.placeholderExample, { color: colors.secondaryLabel }]}>
							{examples[expression] ?? ""}
						</Text>
					</Pressable>
				))}
			</ScrollView>
		</View>
	)
}

function TemplatePreview({ raw }: { raw: string | null }) {
	const themeTokens = useMobileEditorThemeTokens()
	const parsed = useMemo(() => (raw === null ? null : parseFrontmatter(raw)), [raw])
	const properties = useMemo(
		() =>
			Object.entries(parsed?.meta ?? {}).map(([key, value]) => {
				const text = value === null || value === undefined ? "" : String(value)
				return {
					key,
					placeholder: text.includes("{{"),
					value: replacePlaceholders(text).replaceAll("`", ""),
				}
			}),
		[parsed],
	)
	const body = useMemo(() => replacePlaceholders(parsed?.body ?? ""), [parsed])

	return (
		<ScrollView contentContainerStyle={styles.preview} contentInsetAdjustmentBehavior="automatic">
			<PropertiesBox properties={properties} />
			{body.trim() ? (
				<MarkdownBlock
					content={body}
					dom={{
						matchContents: true,
						scrollEnabled: false,
						style: styles.transparent,
						useExpoDOMWebView: false,
					}}
					themeTokens={themeTokens}
				/>
			) : null}
		</ScrollView>
	)
}

function placeholderExamples(
	vault: TemplateVault,
	name: string,
	id: string,
): Record<string, string> {
	const context = createTemplateContext(vault, { id, name }, name)
	const examples: Record<string, string> = {}
	for (const group of getTemplateValueGroups(context)) {
		for (const option of group.options) examples[option.expression] = option.example
	}
	return examples
}

async function deleteTemplate(vault: TemplateVault, template: TemplateDefinition): Promise<void> {
	try {
		await useTemplateStore.getState().deleteTemplate(vault, template.id)
		toast(`Deleted “${template.name}”`)
		if (router.canGoBack()) router.back()
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

function confirmDelete(vault: TemplateVault | null, template: TemplateDefinition | null) {
	if (!vault || !template) return
	Alert.alert(`Delete “${template.name}”?`, "Notes already created from it stay as they are.", [
		{ style: "cancel", text: "Cancel" },
		{ onPress: () => void deleteTemplate(vault, template), style: "destructive", text: "Delete" },
	])
}

export function TemplateEditorScreen() {
	useHideTabBar()
	const params = useLocalSearchParams<{ filePath?: string | string[] }>()
	const filePath = readParam(params.filePath)
	const { colors } = useMobileColors()
	const { templates, vault } = useVaultTemplates()
	const [mode, setMode] = useState<DisplayMode>("source")

	const template = useMemo(
		() =>
			vault && filePath
				? (templates.find((item) => getTemplateBodyFilePath(vault.path, item) === filePath) ?? null)
				: null,
		[filePath, templates, vault],
	)
	const name = template?.name ?? "Template"
	const raw = useTemplateFileContent(filePath, mode === "preview")
	const examples = useMemo(
		() => (vault ? placeholderExamples(vault, name, template?.id ?? "template") : {}),
		[name, template?.id, vault],
	)

	const openSettings = () => {
		if (template) openTemplateSettings(template.id)
	}
	const shareTemplate = () => {
		if (filePath) presentSheet("share-template", { filePath, templateId: template?.id })
	}

	const menuGroups: MenuGroup[] = [
		...(IS_IOS
			? []
			: [
					MODE_OPTIONS.map((option) => ({
						checked: mode === option.value,
						key: option.value,
						label: option.label,
						onPress: () => setMode(option.value),
					})),
				]),
		[
			{
				disabled: !template,
				icon: { md: "tune", sf: "slider.horizontal.3" },
				key: "settings",
				label: "New note settings",
				onPress: openSettings,
			},
			{
				icon: { md: "share", sf: "square.and.arrow.up" },
				key: "share",
				label: "Share as template",
				onPress: shareTemplate,
			},
		],
		[
			{
				destructive: true,
				disabled: !template,
				icon: { md: "delete", sf: "trash" },
				key: "delete",
				label: "Delete template",
				onPress: () => confirmDelete(vault, template),
			},
		],
	]

	return (
		<View style={[styles.root, { backgroundColor: colors.background }]}>
			<Stack.Screen
				options={{
					headerLargeTitleEnabled: false,
					headerRight: IS_IOS
						? undefined
						: () => (
								<NativeMenu
									accessibilityLabel="Template actions"
									groups={menuGroups}
									icon={{ md: "more_vert", sf: "ellipsis" }}
								/>
							),
					title: name,
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.View>
						<View style={styles.segmentedSlot}>
							<SegmentedControl
								accessibilityLabel="Show template as"
								onChange={setMode}
								options={MODE_OPTIONS}
								style={styles.segmented}
								value={mode}
							/>
						</View>
					</Stack.Toolbar.View>
					<Stack.Toolbar.Menu accessibilityLabel="Template actions" icon="ellipsis" title={name}>
						{menuGroups.flat().map((item) => (
							<Stack.Toolbar.MenuAction
								destructive={item.destructive}
								disabled={item.disabled}
								icon={item.icon?.sf}
								key={item.key}
								onPress={item.onPress}
							>
								{item.label}
							</Stack.Toolbar.MenuAction>
						))}
					</Stack.Toolbar.Menu>
				</Stack.Toolbar>
			) : null}
			{mode === "source" ? (
				<View style={styles.editor}>
					<NoteEditorScreen filePath={filePath} top={<PlaceholderBar examples={examples} />} />
				</View>
			) : (
				<TemplatePreview raw={raw} />
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	editor: {
		flex: 1,
		minHeight: 0,
	},
	placeholderBar: {
		gap: 6,
		paddingBottom: 8,
	},
	placeholderChip: {
		alignItems: "center",
		borderRadius: 10,
		flexDirection: "row",
		gap: 8,
		height: 36,
		paddingHorizontal: 12,
	},
	placeholderChips: {
		gap: 8,
		paddingHorizontal: 16,
	},
	placeholderCode: {
		fontFamily: Platform.select({ android: "monospace", default: "Menlo" }),
		fontSize: 13,
	},
	placeholderExample: {
		fontSize: 13,
		lineHeight: 18,
	},
	placeholderLabel: {
		fontSize: 12,
		fontWeight: "600",
		lineHeight: 16,
		paddingHorizontal: 20,
	},
	preview: {
		gap: 12,
		paddingBottom: 48,
		paddingHorizontal: 20,
		paddingTop: 8,
	},
	root: {
		flex: 1,
	},
	segmented: {
		width: 168,
	},
	segmentedSlot: {
		height: 32,
		justifyContent: "center",
		width: 168,
	},
	transparent: {
		backgroundColor: "transparent",
	},
})
