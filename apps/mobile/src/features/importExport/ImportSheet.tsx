import { Stack } from "expo-router"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import {
	CLOSE_ICON,
	HeaderActions,
	useCloseSheetStack,
} from "@/features/importExport/HeaderActions"
import { ImportProvider, useImport } from "@/features/importExport/ImportContext"
import { pushImportStep } from "@/features/importExport/importNavigation"
import { useStackScreenOptions } from "@/features/navigation/useStackScreenOptions"

export function ImportLayout() {
	const screenOptions = useStackScreenOptions()
	return (
		<ImportProvider>
			<Stack screenOptions={{ ...screenOptions, headerLargeTitleEnabled: false }}>
				<Stack.Screen name="index" options={{ title: "Import" }} />
				<Stack.Screen
					name="progress"
					options={{ gestureEnabled: false, headerBackVisible: false, title: "Importing" }}
				/>
				<Stack.Screen
					name="obsidian-done"
					options={{ gestureEnabled: false, headerBackVisible: false }}
				/>
				<Stack.Screen
					name="done"
					options={{ gestureEnabled: false, headerBackVisible: false, title: "Imported" }}
				/>
			</Stack>
		</ImportProvider>
	)
}

export function ImportSourceScreen() {
	const { actions, derived, state } = useImport()
	const close = useCloseSheetStack()

	function pickFolder() {
		void actions.chooseFolder().then((next) => {
			if (next) pushImportStep(next)
		})
	}

	function pickFiles() {
		void actions.chooseFiles().then((picked) => {
			if (picked) pushImportStep("review")
		})
	}

	return (
		<>
			<Stack.Screen options={{ title: "Import" }} />
			<HeaderActions left={{ icon: CLOSE_ICON, label: "Close", onPress: close }} />
			<NativeForm>
				<FormSection
					footer={`Markdown files are already notes: copy them into ${derived.vaultName}.`}
				>
					<FormRow
						chevron
						disabled={state.busy}
						icon={{ md: "diamond", sf: "diamond" }}
						onPress={pickFolder}
						subtitle="Notes, attachments and settings"
						title="Obsidian vault"
					/>
					<FormRow
						chevron
						disabled={state.busy}
						icon={{ md: "description", sf: "doc" }}
						onPress={pickFiles}
						subtitle="CSV, HTML or PDF"
						title="Files"
					/>
					<FormRow
						chevron
						disabled={state.busy}
						icon={{ md: "folder", sf: "folder" }}
						onPress={pickFolder}
						subtitle="Every CSV, HTML and PDF file inside"
						title="Folder"
					/>
				</FormSection>
			</NativeForm>
		</>
	)
}
