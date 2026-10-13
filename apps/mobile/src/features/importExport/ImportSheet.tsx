import { Platform, ScrollView, StyleSheet, View } from "react-native"

import { dismissSheet, goToFilesRoot, openFolder } from "@/features/navigation/routes"
import {
	ImportChooseStage,
	ImportDoneStage,
	ImportPreviewStage,
	ImportReviewStage,
} from "@/features/importExport/ImportFileStages"
import {
	ImportDetectStage,
	ImportObsidianCta,
	ImportObsidianDoneStage,
	ImportObsidianStage,
	ImportRunStage,
} from "@/features/importExport/ImportObsidianStages"
import { destinationPath, obsidianTitle, previewPathLabel } from "@/features/importExport/importPlan"
import { SheetNavBar, type SheetNavLeading, type SheetNavTrailing } from "@/features/importExport/SheetNavBar"
import { useImportSheet } from "@/features/importExport/useImportSheet"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

function finishToFiles(): void {
	dismissSheet()
	goToFilesRoot()
}

export function ImportSheet() {
	const { colors } = useMobileColors()
	const controller = useImportSheet()
	const { actions, derived, state } = controller
	const toChoose = () => actions.setStage("choose")
	const toReview = () => actions.setStage("review")

	let title = "Import"
	let subtitle: string | undefined
	let leading: SheetNavLeading = { kind: "none" }
	let trailing: SheetNavTrailing = { kind: "none" }
	switch (state.stage) {
		case "choose":
			leading = IS_IOS ? { kind: "cancel", onPress: dismissSheet } : { kind: "close", onPress: dismissSheet }
			break
		case "review":
			title = `Import ${state.files.length} ${state.files.length === 1 ? "file" : "files"}`
			leading = IS_IOS ? { kind: "cancel", onPress: toChoose } : { kind: "close", onPress: toChoose }
			trailing = {
				disabled: state.busy || derived.importable === 0,
				kind: "text",
				label: "Import",
				onPress: actions.runImport,
			}
			break
		case "preview":
			title = derived.selectedPlan?.file.name ?? "Preview"
			subtitle = previewPathLabel(derived.selectedPlan, derived.destination)
			leading = { kind: "back", onPress: toReview }
			break
		case "done":
			leading = IS_IOS ? { kind: "none" } : { kind: "close", onPress: finishToFiles }
			trailing = { kind: "done", onPress: finishToFiles }
			break
		case "detect":
			title = "Import a folder"
			leading = { kind: "back", onPress: toChoose }
			trailing = { kind: "text", label: "Next", onPress: actions.detectNext }
			break
		case "obs":
			title = obsidianTitle(state.obsidianMode)
			leading = { kind: "back", onPress: toChoose }
			break
		case "run":
			title = `Importing ${state.folder?.name ?? ""}`
			break
		case "obsdone":
			title = obsidianTitle(state.outcome?.mode ?? state.obsidianMode)
			leading = IS_IOS ? { kind: "none" } : { kind: "close", onPress: finishToFiles }
			trailing = { kind: "done", onPress: finishToFiles }
			break
	}

	const openImportedFolder = () => {
		const path = destinationPath(derived.vaultPath, derived.destination)
		dismissSheet()
		if (path === derived.vaultPath) goToFilesRoot()
		else openFolder(path)
	}

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<SheetNavBar leading={leading} subtitle={subtitle} title={title} trailing={trailing} />
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				style={styles.scroll}
			>
				{state.stage === "choose" ? (
					<ImportChooseStage
						busy={state.busy}
						onChooseFiles={actions.chooseFiles}
						onChooseFolder={actions.chooseFolder}
						onObsidian={actions.chooseFolder}
						vaultName={derived.vaultName}
					/>
				) : state.stage === "review" ? (
					<ImportReviewStage controller={controller} />
				) : state.stage === "preview" ? (
					<ImportPreviewStage controller={controller} />
				) : state.stage === "done" ? (
					<ImportDoneStage controller={controller} onOpenFolder={openImportedFolder} />
				) : state.stage === "detect" ? (
					<ImportDetectStage controller={controller} />
				) : state.stage === "obs" ? (
					<ImportObsidianStage controller={controller} />
				) : state.stage === "run" ? (
					<ImportRunStage controller={controller} />
				) : (
					<ImportObsidianDoneStage controller={controller} onOpenFiles={finishToFiles} />
				)}
			</ScrollView>
			{state.stage === "obs" ? <ImportObsidianCta controller={controller} /> : null}
		</View>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingTop: 4,
	},
	root: {
		flex: 1,
	},
	scroll: {
		flex: 1,
	},
})
