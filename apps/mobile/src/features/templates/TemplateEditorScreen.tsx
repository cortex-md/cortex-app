import { getErrorMessage, openNoteDocumentSession, type TemplateVault } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { parseFrontmatter } from "@cortex/properties"
import {
	getTemplateValueGroups,
	getTemplateValueLabel,
	splitTemplateSegments,
} from "@cortex/templates"
import { Stack, useLocalSearchParams } from "expo-router"
import { Share2, SlidersHorizontal } from "lucide-react-native"
import { useEffect, useMemo, useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { Badge } from "@/components/ui/Badge"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import MarkdownBlock from "@/components/ui/MarkdownBlock"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { NoteEditorScreen } from "@/features/editor/NoteEditorScreen"
import { useMobileEditorThemeTokens } from "@/features/editor/editorTheme"
import { toast } from "@/features/feedback/useToast"
import { presentSheet } from "@/features/navigation/routes"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import { PropertiesBox } from "@/features/templates/TemplateFields"
import { TemplateSettingsSheet } from "@/features/templates/TemplateSettingsSheet"
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

function HeaderTitle({ subtitle, title }: { subtitle: string; title: string }) {
	const { colors } = useMobileColors()
	return (
		<View style={IS_IOS ? styles.headerTitleIos : undefined}>
			<Text numberOfLines={1} style={[styles.headerTitle, { color: colors.label }]}>
				{title}
			</Text>
			<Text numberOfLines={1} style={[styles.headerSubtitle, { color: colors.secondaryLabel }]}>
				{subtitle}
			</Text>
		</View>
	)
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

function TemplatePreview({ name, raw }: { name: string; raw: string | null }) {
	const { colors } = useMobileColors()
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
		<ScrollView contentContainerStyle={styles.preview}>
			<Text
				style={[styles.crumb, { color: colors.secondaryLabel }]}
			>{`Templates / ${name}.md`}</Text>
			<View style={styles.titleRow}>
				<Text style={[styles.previewTitle, { color: colors.label }]}>{name}</Text>
				<Badge label="Template" tint />
			</View>
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

export function TemplateEditorScreen() {
	useHideTabBar()
	const params = useLocalSearchParams<{ filePath?: string | string[] }>()
	const filePath = readParam(params.filePath)
	const { colors } = useMobileColors()
	const { templates, vault } = useVaultTemplates()
	const [mode, setMode] = useState<DisplayMode>("source")
	const [settingsOpen, setSettingsOpen] = useState(false)

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

	const openTemplateSettings = () => setSettingsOpen(true)
	const shareTemplate = () => {
		if (filePath) presentSheet("share-template", { filePath, templateId: template?.id })
	}

	return (
		<View style={[styles.root, { backgroundColor: colors.background }]}>
			<Stack.Screen
				options={{
					headerLargeTitleEnabled: false,
					headerRight: IS_IOS
						? undefined
						: () => (
								<View style={styles.androidActions}>
									<HeaderIconButton
										Icon={SlidersHorizontal}
										accessibilityLabel="Template settings"
										onPress={openTemplateSettings}
									/>
									<HeaderIconButton
										Icon={Share2}
										accessibilityLabel="Share template"
										onPress={shareTemplate}
									/>
								</View>
							),
					headerTitle: () => <HeaderTitle subtitle="Saved" title={name} />,
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Button
						accessibilityLabel="Template settings"
						icon="slider.horizontal.3"
						onPress={openTemplateSettings}
					/>
					<Stack.Toolbar.Button
						accessibilityLabel="Share template"
						icon="square.and.arrow.up"
						onPress={shareTemplate}
					/>
				</Stack.Toolbar>
			) : null}
			<View style={styles.controls}>
				<SegmentedControl
					accessibilityLabel="Show placeholders as"
					onChange={setMode}
					options={MODE_OPTIONS}
					value={mode}
				/>
				{mode === "source" ? (
					<View style={styles.crumbRow}>
						<Text
							numberOfLines={1}
							style={[styles.crumb, styles.crumbFlex, { color: colors.secondaryLabel }]}
						>
							{`Templates / ${name}.md`}
						</Text>
						<Badge label="Template" tint />
					</View>
				) : null}
			</View>
			{mode === "source" ? (
				<View style={styles.editor}>
					<NoteEditorScreen filePath={filePath} top={<PlaceholderBar examples={examples} />} />
				</View>
			) : (
				<TemplatePreview name={name} raw={raw} />
			)}
			<TemplateSettingsSheet
				isPresented={settingsOpen}
				onDismiss={() => setSettingsOpen(false)}
				template={template}
				vault={vault}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	androidActions: {
		flexDirection: "row",
	},
	controls: {
		gap: 8,
		paddingBottom: 6,
		paddingHorizontal: 16,
		paddingTop: 4,
	},
	crumb: {
		fontSize: 13,
		lineHeight: 18,
	},
	crumbFlex: {
		flex: 1,
	},
	crumbRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		paddingHorizontal: 4,
	},
	editor: {
		flex: 1,
		minHeight: 0,
	},
	headerSubtitle: {
		fontSize: 12,
		lineHeight: 16,
		textAlign: IS_IOS ? "center" : "left",
	},
	headerTitle: {
		fontSize: IS_IOS ? 17 : 22,
		fontWeight: IS_IOS ? "600" : "400",
		lineHeight: IS_IOS ? 22 : 28,
		textAlign: IS_IOS ? "center" : "left",
	},
	headerTitleIos: {
		alignItems: "center",
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
	previewTitle: {
		fontSize: 28,
		fontWeight: "700",
		lineHeight: 34,
	},
	root: {
		flex: 1,
	},
	titleRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
	},
	transparent: {
		backgroundColor: "transparent",
	},
})
