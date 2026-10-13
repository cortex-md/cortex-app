import {
	ChevronRight,
	ChevronsUpDown,
	Code2,
	FileText,
	Folder,
	Gem,
	SkipForward,
	Table2,
} from "lucide-react-native"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { Badge } from "@/components/ui/Badge"
import { GroupedFooter, GroupedList, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import type { SegmentedOption } from "@/components/ui/segmentedTypes"
import { formatCount } from "@/features/importExport/importPlan"
import type {
	ConflictPolicy,
	CsvMode,
	ImportFileKind,
	ImportPreview,
	PlannedImportFile,
} from "@/features/importExport/importTypes"
import { SheetBody, SheetButton, SheetHero } from "@/features/importExport/SheetParts"
import type { ImportSheetController } from "@/features/importExport/useImportSheet"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"

const CONFLICT_OPTIONS: SegmentedOption<ConflictPolicy>[] = [
	{ label: "Keep both", value: "both" },
	{ label: "Skip", value: "skip" },
]

const CSV_OPTIONS: SegmentedOption<CsvMode>[] = [
	{ label: "Table", value: "table" },
	{ label: "Database", value: "database" },
]

const FILE_KINDS: { label: string; title: string; subtitle: string; swatch: keyof MobileColors }[] = [
	{ label: "CSV", subtitle: "One note with a table, or one note per row", swatch: "swatchGreen", title: "A table or a database" },
	{ label: "HTML", subtitle: "Headings, lists, links and tables kept", swatch: "swatchYellow", title: "A note" },
	{ label: "PDF", subtitle: "Extracted page by page", swatch: "swatchRed", title: "A note with the text" },
]

function KindSwatch({ color, label }: { color: string; label: string }) {
	return (
		<View style={styles.kindSwatch}>
			<Text style={[styles.kindSwatchText, { color }]}>{label}</Text>
		</View>
	)
}

function ObsidianIcon({ colors }: { colors: MobileColors }) {
	return (
		<View style={[styles.obsidianIcon, { backgroundColor: colors.accentSubtle }]}>
			<Gem color={colors.headingViolet} size={20} strokeWidth={2} />
		</View>
	)
}

export function ImportChooseStage({
	busy,
	onChooseFiles,
	onChooseFolder,
	onObsidian,
	vaultName,
}: {
	busy: boolean
	onChooseFiles: () => void
	onChooseFolder: () => void
	onObsidian: () => void
	vaultName: string
}) {
	const { colors } = useMobileColors()
	const footer = IS_IOS
		? `A folder with .obsidian inside is recognised as a vault. Markdown files are already notes: move them into ${vaultName} in the Files app. Word, Pages or Keynote: export as PDF first.`
		: `A folder with .obsidian inside is recognised as a vault. Markdown files are already notes: move them into ${vaultName}. Word or Keynote: export as PDF first.`

	return (
		<SheetBody>
			<Text style={[styles.lead, { color: colors.secondaryLabel }]}>What do you want to bring in?</Text>
			<GroupedSectionHeader>Obsidian</GroupedSectionHeader>
			<GroupedList>
				<GroupedRow
					chevron
					leading={<ObsidianIcon colors={colors} />}
					onPress={onObsidian}
					subtitle="Notes, attachments, templates, daily notes and bookmarks. The vault isn’t changed."
					title="Obsidian vault"
				/>
			</GroupedList>
			<GroupedSectionHeader>Files</GroupedSectionHeader>
			<GroupedList>
				{FILE_KINDS.map((kind) => (
					<GroupedRow
						key={kind.label}
						leading={<KindSwatch color={colors[kind.swatch]} label={kind.label} />}
						subtitle={kind.subtitle}
						title={kind.title}
					/>
				))}
				{IS_IOS ? (
					<GroupedRow disabled={busy} onPress={onChooseFiles} tint title="Choose files…" />
				) : null}
				{IS_IOS ? (
					<GroupedRow disabled={busy} onPress={onChooseFolder} tint title="Choose a folder…" />
				) : null}
			</GroupedList>
			{!IS_IOS ? (
				<View style={styles.m3Actions}>
					<SheetButton disabled={busy} label="Choose files" onPress={onChooseFiles} />
					<SheetButton disabled={busy} label="Choose a folder" onPress={onChooseFolder} variant="gray" />
				</View>
			) : null}
			<GroupedFooter>{footer}</GroupedFooter>
		</SheetBody>
	)
}

function fileIcon(kind: ImportFileKind, colors: MobileColors) {
	const color = colors.secondaryLabel
	if (kind === "csv") return <Table2 color={color} size={22} strokeWidth={2} />
	if (kind === "html") return <Code2 color={color} size={22} strokeWidth={2} />
	if (kind === "pdf") return <FileText color={color} size={22} strokeWidth={2} />
	return <SkipForward color={color} size={22} strokeWidth={2} />
}

function PlanRow({ onPress, plan }: { onPress: () => void; plan: PlannedImportFile }) {
	const { colors } = useMobileColors()
	const subtitleColor = plan.status === "ok" ? colors.secondaryLabel : colors.warningText
	return (
		<Pressable
			accessibilityRole="button"
			android_ripple={{ color: colors.hover }}
			onPress={onPress}
			style={({ pressed }) => [styles.planRow, { backgroundColor: pressed && IS_IOS ? colors.hover : "transparent" }]}
		>
			{fileIcon(plan.file.kind, colors)}
			<View style={styles.planBody}>
				<Text numberOfLines={1} style={[styles.planTitle, { color: colors.label }]}>
					{plan.file.name}
				</Text>
				<Text numberOfLines={1} style={[styles.planTarget, { color: subtitleColor }]}>
					{`→ ${plan.targetLabel}`}
				</Text>
			</View>
			{plan.status === "skipped" ? <Badge label="Skipped" /> : null}
			<ChevronRight color={colors.tertiaryLabel} size={IS_IOS ? 14 : 24} strokeWidth={2.4} />
		</Pressable>
	)
}

export function ImportReviewStage({ controller }: { controller: ImportSheetController }) {
	const { colors } = useMobileColors()
	const { actions, derived, state } = controller
	const importLabel = `Import ${derived.importable} ${derived.importable === 1 ? "file" : "files"}`

	return (
		<SheetBody>
			<GroupedSectionHeader
				trailing={
					<Pressable accessibilityRole="button" disabled={state.busy} hitSlop={8} onPress={actions.chooseFiles}>
						<Text style={[styles.inlineAction, { color: colors.tint }]}>Add files</Text>
					</Pressable>
				}
			>
				Files
			</GroupedSectionHeader>
			<GroupedList>
				{derived.plans.map((plan) => (
					<PlanRow key={plan.file.id} onPress={() => actions.openPreview(plan.file.id)} plan={plan} />
				))}
			</GroupedList>
			<GroupedSectionHeader>Save to</GroupedSectionHeader>
			<GroupedList>
				<GroupedRow
					leading={<Folder color={colors.secondaryLabel} size={22} strokeWidth={2} />}
					title={derived.destination.label}
					trailing={
						<NativeMenu
							accessibilityLabel="Save to"
							anchorStyle="plain"
							groups={[
								derived.destinations.map((item, index) => ({
									checked: index === state.destinationIndex,
									key: item.relativePath || "root",
									label: item.label,
									onPress: () => actions.setDestinationIndex(index),
								})),
							]}
							icon={{ Lucide: ChevronsUpDown, sf: "chevron.up.chevron.down" }}
						/>
					}
				/>
			</GroupedList>
			<GroupedSectionHeader>Same name already exists</GroupedSectionHeader>
			<SegmentedControl
				accessibilityLabel="Same name already exists"
				onChange={actions.setConflict}
				options={CONFLICT_OPTIONS}
				style={styles.segment}
				value={state.conflict}
			/>
			<GroupedSectionHeader>CSV files become</GroupedSectionHeader>
			<SegmentedControl
				accessibilityLabel="CSV files become"
				onChange={actions.setCsvMode}
				options={CSV_OPTIONS}
				style={styles.segment}
				value={state.csvMode}
			/>
			<GroupedFooter>{`${formatCount(derived.plannedNotes)} notes · tap a file to preview it`}</GroupedFooter>
			<View style={styles.cta}>
				<SheetButton
					disabled={state.busy || derived.importable === 0}
					label={importLabel}
					onPress={actions.runImport}
				/>
			</View>
		</SheetBody>
	)
}

function CsvTablePreview({ preview }: { preview: Extract<ImportPreview, { kind: "csv-table" }> }) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.table, { backgroundColor: colors.cell, borderColor: colors.borderSubtle }]}>
			<View style={[styles.tableRow, styles.tableHeader, { borderBottomColor: colors.borderSubtle }]}>
				{preview.header.map((cell) => (
					<Text key={cell} numberOfLines={1} style={[styles.tableCell, styles.tableHeaderCell, { color: colors.secondaryLabel }]}>
						{cell}
					</Text>
				))}
			</View>
			{preview.rows.map((row) => (
				<View key={row.join("\u0000")} style={[styles.tableRow, { borderBottomColor: colors.borderSubtle }]}>
					{row.map((cell, index) => (
						<Text key={`${preview.header[index] ?? index}`} numberOfLines={1} style={[styles.tableCell, { color: colors.label }]}>
							{cell}
						</Text>
					))}
				</View>
			))}
		</View>
	)
}

function CsvDatabasePreview({ preview }: { preview: Extract<ImportPreview, { kind: "csv-database" }> }) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.previewStack}>
			<View style={[styles.propsBox, { borderColor: colors.border }]}>
				{preview.properties.map(([key, value]) => (
					<View key={key} style={styles.propRow}>
						<Text numberOfLines={1} style={[styles.propKey, { color: colors.secondaryLabel }]}>
							{key}
						</Text>
						<Text numberOfLines={1} style={[styles.propValue, { color: colors.label }]}>
							{value}
						</Text>
					</View>
				))}
			</View>
			<Text style={[styles.placeholder, { color: colors.tertiaryLabel }]}>
				{`1 of ${formatCount(preview.total)} notes. The folder opens as a table.`}
			</Text>
		</View>
	)
}

function MarkdownPreview({ markdown }: { markdown: string }) {
	const { colors } = useMobileColors()
	const blocks = markdown
		.split(/\n{2,}/u)
		.map((block) => block.trim())
		.filter((block) => block.length > 0 && !/^#\s/u.test(block))
	return (
		<View style={styles.previewStack}>
			{blocks.map((block) => {
				const heading = /^(#{2,6})\s+(.*)$/u.exec(block)
				if (heading) {
					return (
						<Text key={block} style={[styles.previewHeading, { color: colors.label }]}>
							{heading[2]}
						</Text>
					)
				}
				return (
					<Text key={block} style={[styles.previewParagraph, { color: colors.label }]}>
						{block.replace(/\n/gu, " ")}
					</Text>
				)
			})}
		</View>
	)
}

export function ImportPreviewStage({ controller }: { controller: ImportSheetController }) {
	const { colors } = useMobileColors()
	const { derived } = controller
	const preview = derived.selectedPreview
	const title = preview?.title ?? derived.selectedPlan?.file.name ?? ""

	return (
		<SheetBody>
			<View style={styles.previewContent}>
				<Text style={[styles.previewTitle, { color: colors.label }]}>{title}</Text>
				{!preview ? (
					<Text style={[styles.placeholder, { color: colors.tertiaryLabel }]}>Reading file…</Text>
				) : preview.kind === "csv-table" ? (
					<CsvTablePreview preview={preview} />
				) : preview.kind === "csv-database" ? (
					<CsvDatabasePreview preview={preview} />
				) : preview.kind === "html" ? (
					<MarkdownPreview markdown={preview.markdown} />
				) : preview.kind === "pdf" ? (
					<View style={styles.previewStack}>
						{preview.pages.map((page, index) => (
							<Text key={`page-${index + 1}`} style={[styles.placeholder, { color: colors.tertiaryLabel }]}>
								{page}
							</Text>
						))}
					</View>
				) : (
					<Text style={[styles.previewParagraph, { color: colors.label }]}>{preview.message}</Text>
				)}
			</View>
		</SheetBody>
	)
}

export function ImportDoneStage({
	controller,
	onOpenFolder,
}: {
	controller: ImportSheetController
	onOpenFolder: () => void
}) {
	const { colors } = useMobileColors()
	const { actions, derived, state } = controller
	const result = state.runResult

	return (
		<SheetBody>
			<SheetHero
				subtitle={`Saved to ${derived.destination.label}.`}
				title={`${formatCount(result?.notes ?? 0)} notes imported`}
			/>
			<GroupedList>
				{(result?.rows ?? []).map((row) => (
					<View key={row.label} style={styles.resultRow}>
						<Text numberOfLines={1} style={[styles.resultText, { color: row.ok ? colors.successText : colors.warningText }]}>
							{row.label}
						</Text>
					</View>
				))}
			</GroupedList>
			<View style={styles.doneActions}>
				<View style={styles.doneAction}>
					<SheetButton label="Open folder" onPress={onOpenFolder} variant="gray" />
				</View>
				<View style={styles.doneAction}>
					<SheetButton disabled={state.busy} label="Undo import" onPress={actions.undoImport} variant="gray" />
				</View>
			</View>
		</SheetBody>
	)
}

const styles = StyleSheet.create({
	cta: {
		paddingTop: 10,
	},
	doneAction: {
		flex: 1,
	},
	doneActions: {
		flexDirection: "row",
		marginHorizontal: -16,
		paddingHorizontal: 16,
		paddingTop: 18,
	},
	inlineAction: {
		fontSize: IS_IOS ? 15 : 14,
		fontWeight: "500",
		lineHeight: 20,
	},
	kindSwatch: {
		alignItems: "center",
		height: 32,
		justifyContent: "center",
		width: 32,
	},
	kindSwatchText: {
		fontSize: 9,
		fontWeight: "700",
		lineHeight: 11,
	},
	lead: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
		marginBottom: 4,
		marginHorizontal: 20,
		marginTop: IS_IOS ? 0 : 8,
	},
	m3Actions: {
		gap: 10,
		paddingTop: 16,
	},
	obsidianIcon: {
		alignItems: "center",
		borderRadius: 9,
		height: 32,
		justifyContent: "center",
		width: 32,
	},
	placeholder: {
		fontSize: 13,
		lineHeight: 18,
	},
	planBody: {
		flex: 1,
		gap: 2,
		minWidth: 0,
	},
	planRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: IS_IOS ? 12 : 16,
		minHeight: IS_IOS ? 60 : 72,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	planTarget: {
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: IS_IOS ? 18 : 20,
	},
	planTitle: {
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: IS_IOS ? 22 : 24,
	},
	previewContent: {
		gap: 12,
		paddingHorizontal: 20,
		paddingTop: 4,
	},
	previewHeading: {
		fontSize: 18,
		fontWeight: "700",
		lineHeight: 24,
		marginTop: 6,
	},
	previewParagraph: {
		fontSize: 16,
		lineHeight: 24,
	},
	previewStack: {
		gap: 10,
	},
	previewTitle: {
		fontSize: 22,
		fontWeight: "700",
		lineHeight: 28,
	},
	propKey: {
		fontSize: 14,
		fontWeight: "500",
		lineHeight: 18,
		width: 112,
	},
	propRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		minHeight: 44,
		paddingHorizontal: 10,
	},
	propValue: {
		flex: 1,
		fontSize: 15,
		lineHeight: 20,
	},
	propsBox: {
		borderCurve: "continuous",
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth,
		paddingVertical: 2,
	},
	resultRow: {
		justifyContent: "center",
		minHeight: IS_IOS ? 52 : 56,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	resultText: {
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: IS_IOS ? 22 : 24,
	},
	segment: {
		marginHorizontal: 16,
	},
	table: {
		borderCurve: "continuous",
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	tableCell: {
		flex: 1,
		fontSize: 14,
		fontVariant: ["tabular-nums"],
		lineHeight: 18,
		paddingHorizontal: 10,
	},
	tableHeader: {
		minHeight: 36,
	},
	tableHeaderCell: {
		fontSize: 12,
		fontWeight: "600",
	},
	tableRow: {
		alignItems: "center",
		borderBottomWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		minHeight: 40,
	},
})
