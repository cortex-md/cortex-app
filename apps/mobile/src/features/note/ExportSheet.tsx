import { getErrorMessage, useVaultStore } from "@cortex/core"
import { getNoteTitle, getParentPath, toVaultRelativePath } from "@cortex/platform/utils"
import { Check, FileText, Share as ShareIcon } from "lucide-react-native"
import { useState } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { GroupedFooter, GroupedList, GroupedRow } from "@/components/ui/GroupedList"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { SheetHeader } from "@/components/ui/SheetHeader"
import { toast } from "@/features/feedback/useToast"
import { dismissSheet } from "@/features/navigation/routes"
import {
	EXPORT_FOOTER,
	type ExportFormat,
	exportFormatLabels,
	exportNote,
} from "@/features/note/exportAdapter"
import { useSheetFilePath } from "@/features/note/noteSheetParams"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const formats: ExportFormat[] = ["html", "pdf", "csv"]
const formatOptions = formats.map((value) => ({ label: exportFormatLabels[value], value }))

function ConnectedButtons({
	onChange,
	value,
}: {
	onChange: (value: ExportFormat) => void
	value: ExportFormat
}) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.connected}>
			{formats.map((format, index) => {
				const selected = format === value
				return (
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ selected }}
						android_ripple={{ color: colors.hover }}
						key={format}
						onPress={() => onChange(format)}
						style={[
							styles.connectedButton,
							index === 0 ? styles.connectedFirst : null,
							index === formats.length - 1 ? styles.connectedLast : null,
							{ backgroundColor: selected ? colors.accentSubtle : colors.fill },
						]}
					>
						{selected ? <Check color={colors.tint} size={18} strokeWidth={2.4} /> : null}
						<Text style={[styles.connectedLabel, { color: selected ? colors.tint : colors.label }]}>
							{exportFormatLabels[format]}
						</Text>
					</Pressable>
				)
			})}
		</View>
	)
}

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
	const { colors } = useMobileColors()
	const filePath = useSheetFilePath()
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const [format, setFormat] = useState<ExportFormat>("pdf")
	const [exporting, setExporting] = useState(false)
	const title = filePath ? getNoteTitle(filePath) : "Note"
	const folder =
		filePath && vaultPath ? (toVaultRelativePath(getParentPath(filePath), vaultPath) ?? "") : ""

	function handleExport() {
		if (filePath) void runExport(filePath, format, setExporting)
	}

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<SheetHeader onClose={dismissSheet} title="Export" />
			{IS_IOS ? (
				<SegmentedControl
					accessibilityLabel="Export format"
					onChange={setFormat}
					options={formatOptions}
					style={styles.segmented}
					value={format}
				/>
			) : (
				<ConnectedButtons onChange={setFormat} value={format} />
			)}
			<View style={styles.section}>
				<GroupedList>
					<GroupedRow
						leading={<FileText color={colors.secondaryLabel} size={22} strokeWidth={2} />}
						subtitle={folder || "Vault root"}
						title={`${title}.${format}`}
					/>
				</GroupedList>
				<GroupedFooter>{EXPORT_FOOTER}</GroupedFooter>
			</View>
			<Pressable
				accessibilityRole="button"
				android_ripple={{ color: colors.hover }}
				disabled={exporting || !filePath}
				onPress={() => void handleExport()}
				style={({ pressed }) => [
					styles.exportButton,
					{
						backgroundColor: colors.tintFill,
						opacity: exporting ? 0.5 : pressed ? 0.8 : 1,
					},
				]}
			>
				<ShareIcon color={colors.onTint} size={20} strokeWidth={2.2} />
				<Text style={[styles.exportLabel, { color: colors.onTint }]}>Export</Text>
			</Pressable>
		</View>
	)
}

const styles = StyleSheet.create({
	connected: {
		flexDirection: "row",
		gap: 2,
		marginHorizontal: 24,
	},
	connectedButton: {
		alignItems: "center",
		borderRadius: 8,
		flex: 1,
		flexDirection: "row",
		gap: 6,
		height: 48,
		justifyContent: "center",
		overflow: "hidden",
	},
	connectedFirst: {
		borderBottomLeftRadius: 999,
		borderTopLeftRadius: 999,
	},
	connectedLabel: {
		fontSize: 14,
		fontWeight: "500",
		lineHeight: 20,
	},
	connectedLast: {
		borderBottomRightRadius: 999,
		borderTopRightRadius: 999,
	},
	exportButton: {
		alignItems: "center",
		borderRadius: 999,
		flexDirection: "row",
		gap: 8,
		height: IS_IOS ? 52 : 56,
		justifyContent: "center",
		marginHorizontal: IS_IOS ? 16 : 24,
		marginTop: 20,
		overflow: "hidden",
	},
	exportLabel: {
		fontSize: IS_IOS ? 17 : 16,
		fontWeight: "600",
		lineHeight: 22,
	},
	root: {
		paddingBottom: 32,
	},
	section: {
		marginTop: 16,
	},
	segmented: {
		marginHorizontal: 16,
	},
})
