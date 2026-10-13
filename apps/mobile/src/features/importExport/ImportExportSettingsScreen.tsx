import { useVaultStore } from "@cortex/core"
import { Download, Share } from "lucide-react-native"
import { Platform, ScrollView, StyleSheet } from "react-native"

import { GroupedFooter, GroupedList, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import { presentSheet } from "@/features/navigation/routes"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function ImportExportSettingsScreen() {
	useHideTabBar()
	const { colors } = useMobileColors()
	const vaultName = useVaultStore((state) => state.vault?.name ?? "this vault")

	return (
		<ScrollView
			contentContainerStyle={styles.content}
			contentInsetAdjustmentBehavior="automatic"
			style={{ backgroundColor: colors.groupedBackground }}
		>
			<GroupedSectionHeader>Import</GroupedSectionHeader>
			<GroupedList>
				<GroupedRow
					chevron
					leading={<Download color={colors.secondaryLabel} size={IS_IOS ? 20 : 24} strokeWidth={2} />}
					onPress={() => presentSheet("import")}
					subtitle="Obsidian vaults, CSV, HTML and PDF files"
					title="Import…"
				/>
			</GroupedList>
			<GroupedFooter>
				{`A folder with .obsidian inside is recognised as a vault. Markdown files are already notes: move them into ${vaultName}.`}
			</GroupedFooter>
			<GroupedSectionHeader>Export</GroupedSectionHeader>
			<GroupedList>
				<GroupedRow
					leading={<Share color={colors.secondaryLabel} size={IS_IOS ? 20 : 24} strokeWidth={2} />}
					subtitle="Open a note, then choose Export from its menu to share it as HTML, PDF or CSV."
					title="Export a note"
				/>
			</GroupedList>
			<GroupedFooter>
				Databases export as CSV; notes export as HTML or PDF through the system share sheet.
			</GroupedFooter>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 40,
	},
})
