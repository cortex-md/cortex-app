import type { TemplateDefinition } from "@cortex/core"
import { useTemplateStore, useVaultStore } from "@cortex/core"
import { Button } from "@cortex/ui"
import {
	CopyIcon,
	FileTextIcon,
	LayoutTemplateIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import {
	SettingsEmptyState,
	SettingsGroup,
	SettingsList,
	SettingsListItem,
	SettingsPage,
	SettingsSection,
} from "../settings/SettingsPrimitives"
import { TemplateEditorDialog } from "./TemplateEditorDialog"
import { createTemplateDraft, type TemplateEditorDraft as EditorDraft } from "./templateEditorDraft"

export function TemplatesSection() {
	const vault = useVaultStore((state) => state.vault)
	const templates = useTemplateStore((state) => state.templates)
	const ensureTemplatesLoaded = useTemplateStore((state) => state.ensureTemplatesLoaded)
	const createTemplate = useTemplateStore((state) => state.createTemplate)
	const updateTemplate = useTemplateStore((state) => state.updateTemplate)
	const duplicateTemplate = useTemplateStore((state) => state.duplicateTemplate)
	const deleteTemplate = useTemplateStore((state) => state.deleteTemplate)
	const readTemplateBody = useTemplateStore((state) => state.readTemplateBody)
	const [editorOpen, setEditorOpen] = useState(false)
	const [editingTemplate, setEditingTemplate] = useState<TemplateDefinition | null>(null)
	const [draft, setDraft] = useState<EditorDraft | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!vault) return
		ensureTemplatesLoaded(vault)
	}, [ensureTemplatesLoaded, vault])

	const handleCreate = useCallback(() => {
		setEditingTemplate(null)
		setDraft(createTemplateDraft(null, ""))
		setEditorOpen(true)
	}, [])

	const handleEdit = useCallback(
		async (template: TemplateDefinition) => {
			if (!vault) return
			setError(null)
			try {
				const body = await readTemplateBody(vault, template.id)
				setEditingTemplate(template)
				setDraft(createTemplateDraft(template, body))
				setEditorOpen(true)
			} catch (editError) {
				setError(editError instanceof Error ? editError.message : String(editError))
			}
		},
		[readTemplateBody, vault],
	)

	const handleDuplicate = useCallback(
		async (template: TemplateDefinition) => {
			if (!vault) return
			setError(null)
			try {
				await duplicateTemplate(vault, template.id)
			} catch (duplicateError) {
				setError(duplicateError instanceof Error ? duplicateError.message : String(duplicateError))
			}
		},
		[duplicateTemplate, vault],
	)

	const handleDelete = useCallback(
		async (template: TemplateDefinition) => {
			if (!vault) return
			setError(null)
			try {
				await deleteTemplate(vault, template.id)
			} catch (deleteError) {
				setError(deleteError instanceof Error ? deleteError.message : String(deleteError))
			}
		},
		[deleteTemplate, vault],
	)

	const handleSave = useCallback(
		async (nextDraft: EditorDraft) => {
			if (!vault) return
			if (editingTemplate) {
				await updateTemplate(vault, editingTemplate.id, nextDraft)
			} else {
				await createTemplate(vault, nextDraft)
			}
		},
		[createTemplate, editingTemplate, updateTemplate, vault],
	)

	return (
		<SettingsPage>
			<SettingsSection
				title="Templates"
				description="Vault templates stored in .cortex/templates."
				action={
					<Button type="button" size="sm" onClick={handleCreate}>
						<PlusIcon />
						New template
					</Button>
				}
			>
				<SettingsGroup>
					{templates.length === 0 ? (
						<SettingsEmptyState>No templates yet.</SettingsEmptyState>
					) : (
						<SettingsList>
							{templates.map((template) => (
								<SettingsListItem key={template.id}>
									<div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-border bg-bg-secondary text-muted-foreground">
										<LayoutTemplateIcon className="size-4" />
									</div>
									<div className="min-w-0 flex-1">
										<div className="truncate text-[13px] font-medium text-foreground">
											{template.name}
										</div>
										<div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
											<FileTextIcon className="size-3" />
											<span className="truncate">{template.fileNamePattern}</span>
										</div>
									</div>
									<div className="flex shrink-0 items-center gap-1">
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											aria-label={`Edit ${template.name}`}
											onClick={() => handleEdit(template)}
										>
											<PencilIcon />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											aria-label={`Duplicate ${template.name}`}
											onClick={() => handleDuplicate(template)}
										>
											<CopyIcon />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											aria-label={`Delete ${template.name}`}
											onClick={() => handleDelete(template)}
										>
											<Trash2Icon />
										</Button>
									</div>
								</SettingsListItem>
							))}
						</SettingsList>
					)}
				</SettingsGroup>
				{error && <p className="m-0 px-1 text-sm text-destructive">{error}</p>}
			</SettingsSection>
			<TemplateEditorDialog
				open={editorOpen}
				template={editingTemplate}
				initialDraft={draft}
				onOpenChange={setEditorOpen}
				onSave={handleSave}
			/>
		</SettingsPage>
	)
}
