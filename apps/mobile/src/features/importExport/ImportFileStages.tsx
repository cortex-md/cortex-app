import { router, Stack } from "expo-router"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import type { SymbolName } from "@/components/ui/Symbol"
import { FormPicker } from "@/features/importExport/FormFields"
import type { FormPickerOption } from "@/features/importExport/formFieldTypes"
import { HeaderActions, useCloseSheetStack } from "@/features/importExport/HeaderActions"
import { useImport } from "@/features/importExport/ImportContext"
import { pushImportStep } from "@/features/importExport/importNavigation"
import { destinationPath, formatCount, previewPathLabel } from "@/features/importExport/importPlan"
import type {
	ConflictPolicy,
	CsvMode,
	ImportFileKind,
	ImportPreview,
} from "@/features/importExport/importTypes"
import { goToFilesRoot, openFolder } from "@/features/navigation/routes"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

const CONFLICT_OPTIONS: FormPickerOption<ConflictPolicy>[] = [
	{ label: "Keep both", value: "both" },
	{ label: "Skip", value: "skip" },
]

const CSV_OPTIONS: FormPickerOption<CsvMode>[] = [
	{ label: "Table", value: "table" },
	{ label: "Database", value: "database" },
]

const KIND_ICONS: Record<ImportFileKind, SymbolName> = {
	csv: { md: "table", sf: "tablecells" },
	html: { md: "code", sf: "chevron.left.forwardslash.chevron.right" },
	pdf: { md: "picture_as_pdf", sf: "doc.richtext" },
	unsupported: { md: "block", sf: "nosign" },
}

export function ImportReviewScreen() {
	const { actions, derived, state } = useImport()
	const count = state.files.length
	const hasCsv = state.files.some((file) => file.kind === "csv")
	const destinationOptions = derived.destinations.map((item, index) => ({
		label: item.label,
		value: String(index),
	}))

	function runImport() {
		void actions.runImport().then((imported) => {
			if (imported) pushImportStep("done")
		})
	}

	return (
		<>
			<Stack.Screen options={{ title: `Import ${count} ${count === 1 ? "file" : "files"}` }} />
			<HeaderActions
				right={{
					disabled: state.busy || derived.importable === 0,
					label: "Import",
					onPress: runImport,
					primary: true,
				}}
			/>
			<NativeForm>
				<FormSection title="Files">
					{[
						...derived.plans.map((plan) => (
							<FormRow
								chevron
								icon={KIND_ICONS[plan.file.kind]}
								key={plan.file.id}
								onPress={() => {
									actions.openPreview(plan.file.id)
									pushImportStep("preview")
								}}
								subtitle={plan.targetLabel}
								title={plan.file.name}
							/>
						)),
						<FormRow
							disabled={state.busy}
							icon={{ md: "add", sf: "plus" }}
							key="add"
							onPress={() => void actions.chooseFiles()}
							tint
							title="Add files"
						/>,
					]}
				</FormSection>
				<FormSection footer={`${formatCount(derived.plannedNotes)} notes`} title="Options">
					{[
						<FormPicker
							key="destination"
							label="Save to"
							onChange={(value) => actions.setDestinationIndex(Number(value))}
							options={destinationOptions}
							value={String(Math.min(state.destinationIndex, destinationOptions.length - 1))}
						/>,
						<FormPicker
							key="conflict"
							label="If the name exists"
							onChange={actions.setConflict}
							options={CONFLICT_OPTIONS}
							value={state.conflict}
						/>,
						hasCsv ? (
							<FormPicker
								key="csv"
								label="CSV files become"
								onChange={actions.setCsvMode}
								options={CSV_OPTIONS}
								value={state.csvMode}
							/>
						) : null,
					]}
				</FormSection>
			</NativeForm>
		</>
	)
}

function CsvTablePreview({ preview }: { preview: Extract<ImportPreview, { kind: "csv-table" }> }) {
	const { colors } = useMobileColors()
	return (
		<View
			style={[styles.table, { backgroundColor: colors.cell, borderColor: colors.borderSubtle }]}
		>
			<View
				style={[styles.tableRow, styles.tableHeader, { borderBottomColor: colors.borderSubtle }]}
			>
				{preview.header.map((cell) => (
					<Text
						key={cell}
						numberOfLines={1}
						style={[styles.tableCell, styles.tableHeaderCell, { color: colors.secondaryLabel }]}
					>
						{cell}
					</Text>
				))}
			</View>
			{preview.rows.map((row) => (
				<View
					key={row.join("\u0000")}
					style={[styles.tableRow, { borderBottomColor: colors.borderSubtle }]}
				>
					{row.map((cell, index) => (
						<Text
							key={`${preview.header[index] ?? index}`}
							numberOfLines={1}
							style={[styles.tableCell, { color: colors.label }]}
						>
							{cell}
						</Text>
					))}
				</View>
			))}
		</View>
	)
}

function CsvDatabasePreview({
	preview,
}: {
	preview: Extract<ImportPreview, { kind: "csv-database" }>
}) {
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

export function ImportPreviewScreen() {
	const { colors } = useMobileColors()
	const { derived } = useImport()
	const preview = derived.selectedPreview
	const title = derived.selectedPlan?.file.name ?? "Preview"

	return (
		<>
			<Stack.Screen options={{ title }} />
			<ScrollView
				contentContainerStyle={styles.previewContent}
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.background }}
			>
				<Text style={[styles.caption, { color: colors.secondaryLabel }]}>
					{previewPathLabel(derived.selectedPlan, derived.destination)}
				</Text>
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
							<Text
								key={`page-${index + 1}`}
								style={[styles.previewParagraph, { color: colors.label }]}
							>
								{page}
							</Text>
						))}
					</View>
				) : (
					<Text style={[styles.previewParagraph, { color: colors.label }]}>{preview.message}</Text>
				)}
			</ScrollView>
		</>
	)
}

export function ImportDoneScreen() {
	const { actions, derived, state } = useImport()
	const close = useCloseSheetStack()
	const result = state.runResult
	const notes = result?.notes ?? 0

	function openImportedFolder() {
		const path = destinationPath(derived.vaultPath, derived.destination)
		close()
		if (path === derived.vaultPath) goToFilesRoot()
		else openFolder(path)
	}

	function undo() {
		void actions.undoImport().then((undone) => {
			if (undone && router.canGoBack()) router.back()
		})
	}

	return (
		<>
			<Stack.Screen options={{ title: "Imported" }} />
			<HeaderActions right={{ label: "Done", onPress: close, primary: true }} />
			<NativeForm>
				<FormSection
					footer={`Saved to ${derived.destination.label}.`}
					title={`${formatCount(notes)} ${notes === 1 ? "note" : "notes"}`}
				>
					{(result?.rows ?? []).map((row) => (
						<FormRow
							icon={
								row.ok
									? { md: "check_circle", sf: "checkmark.circle" }
									: { md: "warning", sf: "exclamationmark.triangle" }
							}
							key={row.label}
							title={row.label}
						/>
					))}
				</FormSection>
				<FormSection>
					<FormRow
						icon={{ md: "folder_open", sf: "folder" }}
						onPress={openImportedFolder}
						tint
						title="Open folder"
					/>
					<FormRow
						destructive
						disabled={state.busy}
						icon={{ md: "undo", sf: "arrow.uturn.backward" }}
						onPress={undo}
						title="Undo import"
					/>
				</FormSection>
			</NativeForm>
		</>
	)
}

const styles = StyleSheet.create({
	caption: {
		fontSize: IS_IOS ? 13 : 12,
		lineHeight: 18,
	},
	placeholder: {
		fontSize: 13,
		lineHeight: 18,
	},
	previewContent: {
		gap: 12,
		paddingBottom: 40,
		paddingHorizontal: 20,
		paddingTop: 8,
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
