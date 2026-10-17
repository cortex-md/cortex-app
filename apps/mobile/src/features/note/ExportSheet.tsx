import { getErrorMessage, useVaultStore } from "@cortex/core"
import { getNoteTitle, getParentPath, toVaultRelativePath } from "@cortex/platform/utils"
import { Stack } from "expo-router"
import { useState } from "react"
import { Platform } from "react-native"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { toast } from "@/features/feedback/useToast"
import { dismissSheet } from "@/features/navigation/routes"
import {
	type ExportFormat,
	exportFormatDescriptions,
	exportFormatLabels,
	exportNote,
} from "@/features/note/exportAdapter"
import { useSheetFilePath } from "@/features/note/noteSheetParams"

const IS_IOS = Platform.OS === "ios"
const formats: ExportFormat[] = ["pdf", "html", "csv"]

async function runExport(
	filePath: string,
	format: ExportFormat,
	setExporting: (exporting: boolean) => void,
): Promise<void> {
	setExporting(true)
	try {
		if (await exportNote(filePath, format)) dismissSheet()
	} catch (error) {
		toast(getErrorMessage(error))
	} finally {
		setExporting(false)
	}
}

export function ExportSheet() {
	const filePath = useSheetFilePath()
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const [format, setFormat] = useState<ExportFormat>("pdf")
	const [exporting, setExporting] = useState(false)
	const title = filePath ? getNoteTitle(filePath) : "Note"
	const folder =
		filePath && vaultPath ? (toVaultRelativePath(getParentPath(filePath), vaultPath) ?? "") : ""
	const disabled = exporting || !filePath

	function handleExport() {
		if (filePath) void runExport(filePath, format, setExporting)
	}

	return (
		<>
			<Stack.Screen
				options={{
					sheetAllowedDetents: [0.5, 1],
					title: "Export",
					headerRight: IS_IOS
						? undefined
						: () => (
								<HeaderIconButton
									accessibilityLabel="Export"
									icon={{ sf: "square.and.arrow.up", md: "ios_share" }}
									onPress={handleExport}
								/>
							),
				}}
			/>
			{IS_IOS ? (
				<>
					<Stack.Toolbar placement="left">
						<Stack.Toolbar.Button onPress={dismissSheet}>Cancel</Stack.Toolbar.Button>
					</Stack.Toolbar>
					<Stack.Toolbar placement="right">
						<Stack.Toolbar.Button disabled={disabled} onPress={handleExport} variant="done">
							Export
						</Stack.Toolbar.Button>
					</Stack.Toolbar>
				</>
			) : null}
			<NativeForm>
				<FormSection footer={exportFormatDescriptions[format]} title="Format">
					{formats.map((value) => (
						<FormRow
							icon={
								value === format
									? { sf: "checkmark.circle.fill", md: "radio_button_checked" }
									: { sf: "circle", md: "radio_button_unchecked" }
							}
							key={value}
							onPress={() => setFormat(value)}
							title={exportFormatLabels[value]}
						/>
					))}
				</FormSection>
				<FormSection title="File">
					<FormRow
						icon={{ sf: "doc.text", md: "description" }}
						subtitle={folder || undefined}
						title={`${title}.${format}`}
					/>
				</FormSection>
			</NativeForm>
		</>
	)
}
