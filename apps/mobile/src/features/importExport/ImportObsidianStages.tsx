import { router, Stack } from "expo-router"
import { useEffect } from "react"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { FormChoiceRow, FormProgress, FormTextField } from "@/features/importExport/FormFields"
import { HeaderActions, useCloseSheetStack } from "@/features/importExport/HeaderActions"
import { useImport } from "@/features/importExport/ImportContext"
import { pushImportStep, replaceImportStep } from "@/features/importExport/importNavigation"
import { formatCount, obsidianTitle } from "@/features/importExport/importPlan"
import type { DetectChoice } from "@/features/importExport/importTypes"
import { goToFilesRoot } from "@/features/navigation/routes"

const COMPATIBILITY =
	"Notes, attachments, properties, templates, daily notes and bookmarks come over. Dataview, Templater, Canvas and community plugins don’t. The Obsidian vault is never changed."

const PRIMARY_LABELS: Record<DetectChoice, string> = {
	files: "Next",
	obs: "Import",
	open: "Open",
}

export function ImportObsidianScreen() {
	const { actions, derived, state } = useImport()
	const folder = state.folder
	if (!folder) return null
	const choice = state.detectChoice

	function proceed() {
		if (choice === "files") {
			actions.takeFolderFiles()
			pushImportStep("review")
			return
		}
		void actions.runObsidian()
		pushImportStep("progress")
	}

	return (
		<>
			<Stack.Screen options={{ title: folder.name }} />
			<HeaderActions
				right={{
					disabled: state.busy || (choice === "files" && folder.importableFiles.length === 0),
					label: PRIMARY_LABELS[choice],
					onPress: proceed,
					primary: true,
				}}
			/>
			<NativeForm>
				<FormSection title="Obsidian vault">
					<FormRow title="Notes" value={formatCount(folder.notes)} />
					<FormRow title="Attachments" value={formatCount(folder.attachments)} />
					<FormRow title="Templates" value={formatCount(folder.templates)} />
					<FormRow title="Bookmarks" value={formatCount(folder.bookmarks)} />
					<FormRow
						disabled={state.busy}
						onPress={() => void actions.changeFolder()}
						tint
						title="Choose another folder"
					/>
				</FormSection>
				<FormSection title="Import as">
					<FormChoiceRow
						onPress={() => actions.setDetectChoice("obs")}
						selected={choice === "obs"}
						subtitle="Notes and attachments are copied"
						title={`Copy into ${derived.vaultName}`}
					/>
					<FormChoiceRow
						onPress={() => actions.setDetectChoice("open")}
						selected={choice === "open"}
						subtitle="Notes stay where they are"
						title="Open as its own vault"
					/>
					<FormChoiceRow
						onPress={() => actions.setDetectChoice("files")}
						selected={choice === "files"}
						subtitle={`${formatCount(folder.importableFiles.length)} files`}
						title="Only its CSV, HTML and PDF files"
					/>
				</FormSection>
				{choice === "obs" ? (
					<FormSection footer={COMPATIBILITY} title="Destination">
						<FormTextField
							initialValue={state.destinationFolder}
							key={folder.path}
							label="Folder"
							onChangeText={actions.setDestinationFolder}
							placeholder="Vault root"
						/>
						<FormToggle
							onValueChange={actions.setApplySettings}
							subtitle="Attachment folder and daily note format"
							title="Use Obsidian settings"
							value={state.applySettings}
						/>
					</FormSection>
				) : (
					<FormSection footer={COMPATIBILITY}>{null}</FormSection>
				)}
			</NativeForm>
		</>
	)
}

export function ImportProgressScreen() {
	const { actions, state } = useImport()
	const folder = state.folder
	const progress = state.progress
	const completed = progress?.completed ?? 0
	const total = progress?.total ?? folder?.totalFiles ?? 0
	const phase = folder && completed > folder.notes ? "attachments" : "notes"
	const label =
		state.obsidianMode === "open"
			? "Opening the vault…"
			: completed === 0
				? "Reading the vault…"
				: `${formatCount(completed)} of ${formatCount(total)} files · ${phase}`

	useEffect(() => {
		if (state.run === "done") replaceImportStep("obsidian-done")
		else if (state.run === "failed" && router.canGoBack()) router.back()
	}, [state.run])

	return (
		<>
			<Stack.Screen options={{ title: state.obsidianMode === "open" ? "Opening" : "Importing" }} />
			{state.obsidianMode === "copy" ? (
				<HeaderActions left={{ label: "Cancel", onPress: actions.cancelRun }} />
			) : null}
			<NativeForm>
				<FormSection footer="If you cancel, files copied so far are kept." title={folder?.name}>
					<FormProgress label={label} value={total > 0 ? completed / total : 0} />
				</FormSection>
			</NativeForm>
		</>
	)
}

export function ImportObsidianDoneScreen() {
	const { derived, state } = useImport()
	const close = useCloseSheetStack()
	const folder = state.folder
	const outcome = state.outcome
	const finish = () => {
		close()
		goToFilesRoot()
	}
	if (!folder || !outcome) return null
	const isCopy = outcome.mode === "copy"
	const copied = outcome.notes + outcome.attachments
	const title = !isCopy
		? `${folder.name} is open`
		: outcome.cancelled
			? `${formatCount(copied)} files imported`
			: `${folder.name} imported`
	const footer = !isCopy
		? "Its Obsidian settings now apply. Nothing in the folder was rewritten."
		: outcome.cancelled
			? "Import cancelled. Files copied before cancelling were kept."
			: `Saved to ${outcome.destinationLabel || derived.vaultName}. The full list is in Imported from Obsidian.md.`
	const showSettings = isCopy ? outcome.settingsApplied : true

	return (
		<>
			<Stack.Screen options={{ title: obsidianTitle(outcome.mode) }} />
			<HeaderActions right={{ label: "Done", onPress: finish, primary: true }} />
			<NativeForm>
				{isCopy ? (
					<FormSection footer={footer} title={title}>
						<FormRow title="Notes" value={formatCount(outcome.notes)} />
						<FormRow title="Attachments" value={formatCount(outcome.attachments)} />
						<FormRow title="Image embeds converted" value={formatCount(outcome.convertedEmbeds)} />
						<FormRow title="Renamed to avoid conflicts" value={formatCount(outcome.renamed)} />
					</FormSection>
				) : (
					<FormSection footer={footer} title={title}>
						{null}
					</FormSection>
				)}
				{showSettings ? (
					<FormSection title="Settings">
						<FormRow title="Attachment location" value={outcome.settings.attachmentLocation} />
						<FormRow title="Daily notes" value={outcome.settings.dailyNotes} />
						<FormRow title="Templates" value={formatCount(outcome.settings.templates)} />
						<FormRow title="Bookmarks" value={formatCount(outcome.settings.bookmarks)} />
						<FormRow title="Property types" value={formatCount(outcome.settings.propertyTypes)} />
					</FormSection>
				) : null}
				{outcome.findings.length > 0 ? (
					<FormSection title="Not supported in Cortex">
						{outcome.findings.map((finding) => (
							<FormRow
								key={finding.label}
								subtitle={finding.examples || undefined}
								title={finding.label}
								value={formatCount(finding.count)}
							/>
						))}
					</FormSection>
				) : null}
			</NativeForm>
		</>
	)
}
