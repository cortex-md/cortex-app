import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { presentSheet } from "@/features/navigation/routes"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"

export function ImportExportSettingsScreen() {
	useHideTabBar()

	return (
		<NativeForm>
			<FormSection title="Import">
				<FormRow
					chevron
					icon={{ md: "download", sf: "square.and.arrow.down" }}
					onPress={() => presentSheet("import")}
					subtitle="Obsidian vaults, CSV, HTML and PDF files"
					title="Import…"
				/>
			</FormSection>
			<FormSection
				footer="Open a note and choose Export from its menu. Notes export as HTML or PDF, databases as CSV."
				title="Export"
			>
				{null}
			</FormSection>
		</NativeForm>
	)
}
