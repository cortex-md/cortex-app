import { getErrorMessage, type TemplateVault } from "@cortex/core"
import { ArrowLeft, ChevronLeft, Folder, Kanban, Pencil, Table2 } from "lucide-react-native"
import { useEffect, useMemo, useState } from "react"
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"

import { Avatar } from "@/components/ui/Avatar"
import { FilterChip } from "@/components/ui/FilterChip"
import { GroupedFooter, GroupedList, GroupedRow } from "@/components/ui/GroupedList"
import MarkdownBlock from "@/components/ui/MarkdownBlock"
import { MobileTextField } from "@/components/ui/MobileTextField"
import { StatusPill, statusToneFromLabel } from "@/components/ui/StatusPill"
import { useMobileEditorThemeTokens } from "@/features/editor/editorTheme"
import { toast } from "@/features/feedback/useToast"
import { dismissSheet, openDatabase, openNote } from "@/features/navigation/routes"
import { PropertiesBox, TemplateField } from "@/features/templates/TemplateFields"
import { TemplateSheetHeader } from "@/features/templates/TemplateSheetHeader"
import {
	BLANK_TEMPLATE_FOLDER,
	type CreatedFromTemplate,
	type CreateFromTemplateInput,
	createFromTemplateEntry,
	loadNoteTemplateSource,
	type NoteTemplateEntry,
	renderNotePreview,
	type TemplateEntry,
} from "@/features/templates/templatesAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

type DatabaseViewChoice = "board" | "table"

type NoteSource = Awaited<ReturnType<typeof loadNoteTemplateSource>>

async function runCreate(
	vault: TemplateVault,
	entry: TemplateEntry,
	input: CreateFromTemplateInput,
): Promise<CreatedFromTemplate | null> {
	try {
		return await createFromTemplateEntry(vault, entry, input)
	} catch (error) {
		toast(getErrorMessage(error))
		return null
	}
}

function useNoteSource(vault: TemplateVault, entry: TemplateEntry): NoteSource | null {
	const [loaded, setLoaded] = useState<{ key: string; source: NoteSource } | null>(null)

	useEffect(() => {
		if (entry.kind !== "note") return
		let cancelled = false
		void loadNoteTemplateSource(vault, entry).then(
			(source) => {
				if (!cancelled) setLoaded({ key: entry.key, source })
			},
			(error: unknown) => toast(getErrorMessage(error)),
		)
		return () => {
			cancelled = true
		}
	}, [entry, vault])

	return loaded?.key === entry.key ? loaded.source : null
}

function defaultTitle(entry: TemplateEntry, initialTitle: string): string {
	if (initialTitle) return initialTitle
	return entry.kind === "database" ? entry.database.defaultName : ""
}

function TitleInput({
	onChangeText,
	placeholder,
	value,
}: {
	onChangeText: (value: string) => void
	placeholder: string
	value: string
}) {
	const { colors } = useMobileColors()
	if (!IS_IOS) {
		return (
			<View style={styles.m3Title}>
				<MobileTextField
					label="Name"
					onChangeText={onChangeText}
					placeholder={placeholder}
					value={value}
				/>
			</View>
		)
	}
	return (
		<TextInput
			accessibilityLabel="Name"
			onChangeText={onChangeText}
			placeholder={placeholder}
			placeholderTextColor={colors.placeholder}
			style={[styles.title, { color: colors.label }]}
			value={value}
		/>
	)
}

function NotePreviewBody({
	body,
	properties,
}: {
	body: string
	properties: Parameters<typeof PropertiesBox>[0]["properties"]
}) {
	const themeTokens = useMobileEditorThemeTokens()
	return (
		<View style={styles.noteBody}>
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
		</View>
	)
}

function DatabasePreview({
	entry,
	onViewChange,
	view,
}: {
	entry: Extract<TemplateEntry, { kind: "database" }>
	onViewChange: (view: DatabaseViewChoice) => void
	view: DatabaseViewChoice
}) {
	const { colors } = useMobileColors()
	const rowTemplates = entry.database.preset.rowTemplates ?? []
	const rowTemplateNames = rowTemplates.map((template) => template.name).join(", ")
	const rowTemplateLabel = `${rowTemplates.length} row template${rowTemplates.length === 1 ? "" : "s"}`

	return (
		<View style={styles.database}>
			<View style={styles.chips}>
				<FilterChip
					label="Board"
					onPress={() => onViewChange("board")}
					selected={view === "board"}
				/>
				<FilterChip
					label="Table"
					onPress={() => onViewChange("table")}
					selected={view === "table"}
				/>
			</View>
			<View style={styles.flush}>
				<GroupedList>
					<View style={styles.tableHeader}>
						{view === "board" ? (
							<Kanban color={colors.secondaryLabel} size={16} strokeWidth={2} />
						) : (
							<Table2 color={colors.secondaryLabel} size={16} strokeWidth={2} />
						)}
						<Text style={[styles.caption, { color: colors.secondaryLabel }]}>
							Name · Status · Owner
						</Text>
					</View>
					{entry.database.previewRows.map((row) => (
						<GroupedRow
							key={row.name}
							title={row.name}
							trailing={<StatusPill label={row.status} tone={statusToneFromLabel(row.status)} />}
						/>
					))}
				</GroupedList>
			</View>
			<Text style={[styles.caption, styles.databaseNote, { color: colors.secondaryLabel }]}>
				{`Creates a folder with the views and ${rowTemplateLabel}${rowTemplateNames ? ` (${rowTemplateNames})` : ""}. Rows are empty — the examples above are only the template’s preview.`}
			</Text>
		</View>
	)
}

export function TemplatePreviewStep({
	entry,
	initialTitle,
	onBack,
	vault,
}: {
	entry: TemplateEntry
	initialTitle: string
	onBack: () => void
	vault: TemplateVault
}) {
	const { colors } = useMobileColors()
	const source = useNoteSource(vault, entry)
	const [title, setTitle] = useState(() => defaultTitle(entry, initialTitle))
	const [folderOverride, setFolderOverride] = useState<string | null>(null)
	const [fileOverride, setFileOverride] = useState<string | null>(null)
	const [locationOpen, setLocationOpen] = useState(false)
	const [creating, setCreating] = useState(false)
	const [view, setView] = useState<DatabaseViewChoice>("board")

	const preview = useMemo(
		() =>
			entry.kind === "note" && source
				? renderNotePreview(vault, entry as NoteTemplateEntry, source, title.trim())
				: null,
		[entry, source, title, vault],
	)

	const defaultFolder =
		entry.kind === "database"
			? entry.database.defaultFolder
			: entry.kind === "blank"
				? BLANK_TEMPLATE_FOLDER
				: (preview?.targetFolder ?? "")
	const defaultFile =
		entry.kind === "note"
			? (preview?.fileName ?? "")
			: title.trim() || (entry.kind === "database" ? entry.database.defaultName : "Untitled")
	const folder = folderOverride ?? defaultFolder
	const file = fileOverride ?? defaultFile
	const where = `${folder || vault.name} / ${file}${entry.kind === "database" ? "" : ".md"}`

	function create() {
		if (creating) return
		setCreating(true)
		void runCreate(vault, entry, {
			fileName: entry.kind === "note" ? (fileOverride ?? "") : file,
			folder,
			title,
		}).then((created) => {
			if (!created) {
				setCreating(false)
				return
			}
			dismissSheet()
			if (created.kind === "database") openDatabase(created.path)
			else openNote(created.path)
		})
	}

	return (
		<View style={styles.root}>
			<TemplateSheetHeader
				leading={{
					Icon: IS_IOS ? ChevronLeft : ArrowLeft,
					label: "All templates",
					onPress: onBack,
				}}
				title={entry.name}
				trailing={{
					disabled: creating || (entry.kind === "note" && !preview),
					iosText: true,
					label: creating ? "Opening…" : "Create",
					onPress: create,
					prominent: true,
				}}
			/>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.article}>
					<TitleInput
						onChangeText={setTitle}
						placeholder={entry.kind === "database" ? "Database name" : "Untitled"}
						value={title}
					/>
					{entry.kind === "database" ? (
						<DatabasePreview entry={entry} onViewChange={setView} view={view} />
					) : preview ? (
						<NotePreviewBody body={preview.body} properties={preview.properties} />
					) : null}
				</View>

				<GroupedList>
					<GroupedRow
						accessibilityLabel={`Location: ${where}`}
						chevron={IS_IOS}
						leading={
							<Folder color={colors.secondaryLabel} size={IS_IOS ? 20 : 24} strokeWidth={2} />
						}
						onPress={() => setLocationOpen((open) => !open)}
						title={where}
						trailing={
							IS_IOS ? undefined : (
								<Pencil color={colors.secondaryLabel} size={20} strokeWidth={2} />
							)
						}
					/>
					{locationOpen ? (
						<View style={IS_IOS ? undefined : styles.m3Fields}>
							<TemplateField label="Folder" onChangeText={setFolderOverride} value={folder} />
							{IS_IOS ? (
								<View style={[styles.separator, { backgroundColor: colors.separator }]} />
							) : null}
							<TemplateField label="File name" onChangeText={setFileOverride} value={file} />
						</View>
					) : null}
				</GroupedList>
				<GroupedFooter>
					Dashed values come from placeholders, filled with today’s values.
				</GroupedFooter>
				{entry.team ? (
					<View style={styles.teamFooter}>
						<Avatar name={entry.team.ownerName} size={18} />
						<Text style={[styles.teamText, { color: colors.secondaryLabel }]}>
							{`Shared by ${entry.team.ownerName} with ${entry.team.groupName}${entry.team.updatedLabel ? ` · updated ${entry.team.updatedLabel}` : ""}`}
						</Text>
					</View>
				) : null}
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	article: {
		gap: 12,
		paddingBottom: 14,
		paddingHorizontal: 20,
		paddingTop: 6,
	},
	caption: {
		fontSize: 13,
		lineHeight: 18,
	},
	chips: {
		flexDirection: "row",
		gap: 8,
	},
	content: {
		paddingBottom: 40,
	},
	database: {
		gap: 10,
	},
	databaseNote: {
		marginTop: 0,
	},
	flush: {
		marginHorizontal: -16,
	},
	m3Fields: {
		gap: 16,
		padding: 16,
	},
	m3Title: {
		marginHorizontal: -4,
	},
	noteBody: {
		gap: 12,
	},
	root: {
		flex: 1,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		marginLeft: 16,
	},
	tableHeader: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		minHeight: 36,
		paddingHorizontal: 16,
	},
	teamFooter: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		marginHorizontal: IS_IOS ? 36 : 32,
		marginTop: 10,
	},
	teamText: {
		flex: 1,
		fontSize: IS_IOS ? 13 : 12,
		lineHeight: IS_IOS ? 18 : 16,
	},
	title: {
		fontSize: 28,
		fontWeight: "700",
		lineHeight: 34,
		padding: 0,
	},
	transparent: {
		backgroundColor: "transparent",
	},
})
