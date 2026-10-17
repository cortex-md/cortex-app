import { getErrorMessage, type TemplateVault } from "@cortex/core"
import { Stack } from "expo-router"
import { useEffect, useMemo, useState } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { toast } from "@/features/feedback/useToast"
import { FormText, FormTextField } from "@/features/importExport/FormFields"
import {
	CLOSE_ICON,
	HeaderActions,
	useCloseSheetStack,
} from "@/features/importExport/HeaderActions"
import { openDatabase, openNote } from "@/features/navigation/routes"
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

const BODY_PREVIEW_LIMIT = 600

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

function bodyExcerpt(body: string): string {
	const trimmed = body.trim()
	return trimmed.length > BODY_PREVIEW_LIMIT ? `${trimmed.slice(0, BODY_PREVIEW_LIMIT)}…` : trimmed
}

function teamFooter(entry: TemplateEntry): string | undefined {
	if (!entry.team) return undefined
	const updated = entry.team.updatedLabel ? ` · updated ${entry.team.updatedLabel}` : ""
	return `Shared by ${entry.team.ownerName} with ${entry.team.groupName}${updated}`
}

export function TemplatePreviewScreen({
	entry,
	initialTitle,
	standalone = false,
	vault,
}: {
	entry: TemplateEntry
	initialTitle: string
	standalone?: boolean
	vault: TemplateVault
}) {
	const close = useCloseSheetStack()
	const source = useNoteSource(vault, entry)
	const [title, setTitle] = useState(() => defaultTitle(entry, initialTitle))
	const [folderOverride, setFolderOverride] = useState<string | null>(null)
	const [creating, setCreating] = useState(false)

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
	const file =
		entry.kind === "note"
			? (preview?.fileName ?? "")
			: title.trim() || (entry.kind === "database" ? entry.database.defaultName : "Untitled")
	const folder = folderOverride ?? defaultFolder
	const fileLabel = entry.kind === "database" ? file : `${file}.md`
	const loading = entry.kind === "note" && !preview

	function create() {
		if (creating) return
		setCreating(true)
		void runCreate(vault, entry, {
			fileName: entry.kind === "note" ? "" : file,
			folder,
			title,
		}).then((created) => {
			if (!created) {
				setCreating(false)
				return
			}
			close()
			if (created.kind === "database") openDatabase(created.path)
			else openNote(created.path)
		})
	}

	return (
		<>
			<Stack.Screen options={{ title: entry.name }} />
			<HeaderActions
				left={standalone ? { icon: CLOSE_ICON, label: "Close", onPress: close } : undefined}
				right={{ disabled: creating || loading, label: "Create", onPress: create, primary: true }}
			/>
			<NativeForm>
				<FormSection>
					<FormTextField
						initialValue={title}
						label="Name"
						onChangeText={setTitle}
						placeholder={entry.kind === "database" ? "Database name" : "Untitled"}
					/>
				</FormSection>
				<FormSection footer={teamFooter(entry)} title="Location">
					<FormTextField
						initialValue={folder}
						key={loading ? "loading" : "ready"}
						label="Folder"
						onChangeText={setFolderOverride}
						placeholder={vault.name}
					/>
					<FormRow title="File" value={fileLabel} />
				</FormSection>
				{preview && preview.properties.length > 0 ? (
					<FormSection title="Properties">
						{preview.properties.map((property) => (
							<FormRow key={property.key} title={property.key} value={property.value || "Empty"} />
						))}
					</FormSection>
				) : null}
				{preview && preview.body.trim() ? (
					<FormSection title="Body">
						<FormText monospace text={bodyExcerpt(preview.body)} />
					</FormSection>
				) : null}
				{entry.kind === "database" ? (
					<FormSection
						footer="Creates a folder with the views and row templates. Rows start empty."
						title="Preview"
					>
						{entry.database.previewRows.map((row) => (
							<FormRow key={row.name} title={row.name} value={row.status} />
						))}
					</FormSection>
				) : null}
			</NativeForm>
		</>
	)
}
