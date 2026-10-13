import { useEditorStore, useTemplateStore, useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import {
	Button,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	FolderPicker,
	Input,
	Label,
	NativeSelect,
	NativeSelectOption,
	RadioCard,
	RadioGroup,
} from "@cortex/ui"
import { useState } from "react"
import { ModalStoreHost } from "@/utils/ModalHost"
import {
	type NewTemplateStart,
	type NewTemplateTarget,
	newTemplateModal,
	openTemplateEditor,
} from "./templateActions"
import { useTemplateFolderOptions } from "./useTemplateFolderOptions"
import "./templates.css"

function getNoteName(path: string): string {
	const name = path.split(/[\\/]/).pop() ?? path
	return name.replace(/\.md$/i, "")
}

export function NewTemplateHost() {
	return (
		<ModalStoreHost store={newTemplateModal}>
			{(target) => <NewTemplateContent target={target} />}
		</ModalStoreHost>
	)
}

function NewTemplateContent({ target }: { target: NewTemplateTarget }) {
	const vault = useVaultStore((state) => state.vault)
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const flushActive = useEditorStore((state) => state.flushActive)
	const templates = useTemplateStore((state) => state.templates)
	const createTemplate = useTemplateStore((state) => state.createTemplate)
	const createTemplateFromNote = useTemplateStore((state) => state.createTemplateFromNote)
	const duplicateTemplate = useTemplateStore((state) => state.duplicateTemplate)
	const updateTemplate = useTemplateStore((state) => state.updateTemplate)
	const folderOptions = useTemplateFolderOptions()
	const notePath = target.notePath ?? (activeFilePath?.endsWith(".md") ? activeFilePath : null)
	const copyable = templates.filter((template) => template.source !== "team")
	const [start, setStart] = useState<NewTemplateStart>(
		target.start ?? (notePath ? "note" : "blank"),
	)
	const [name, setName] = useState(notePath ? getNoteName(notePath) : "")
	const [folder, setFolder] = useState("")
	const [copyId, setCopyId] = useState(target.copyTemplateId ?? copyable[0]?.id ?? "")
	const [creating, setCreating] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const trimmedName = name.trim()
	const copyName = copyable.find((template) => template.id === copyId)?.name

	const handleCreate = async () => {
		if (!vault || !trimmedName || creating) return
		setCreating(true)
		setError(null)
		try {
			let templateId: string
			if (start === "note" && notePath) {
				if (notePath === activeFilePath) await flushActive()
				const noteContent = await getPlatform().fs.readFile(notePath)
				templateId = (
					await createTemplateFromNote(vault, {
						name: trimmedName,
						noteContent,
						targetFolderPattern: folder,
					})
				).id
			} else if (start === "copy" && copyId) {
				const copy = await duplicateTemplate(vault, copyId)
				templateId = (
					await updateTemplate(vault, copy.id, { name: trimmedName, targetFolderPattern: folder })
				).id
			} else {
				templateId = (
					await createTemplate(vault, {
						name: trimmedName,
						body: "",
						targetFolderPattern: folder,
						fileNamePattern: "{{ note.title }}",
						askName: true,
					})
				).id
			}
			newTemplateModal.close()
			openTemplateEditor(templateId, trimmedName)
		} catch (createError) {
			setError(createError instanceof Error ? createError.message : String(createError))
			setCreating(false)
		}
	}

	return (
		<DialogContent className="template-new-dialog">
			<DialogHeader>
				<DialogTitle>New template</DialogTitle>
				<DialogDescription className="sr-only">
					Name the template, choose where it starts from and where new notes go.
				</DialogDescription>
			</DialogHeader>
			<form
				className="template-new-body"
				onSubmit={(event) => {
					event.preventDefault()
					void handleCreate()
				}}
			>
				<Input
					autoFocus
					className="template-title-input"
					value={name}
					placeholder="Template name"
					aria-label="Template name"
					onChange={(event) => setName(event.target.value)}
				/>
				<div className="template-new-section">
					<Label id="template-new-start">Start from</Label>
					<RadioGroup
						aria-labelledby="template-new-start"
						value={start}
						onValueChange={(value) => setStart(value as NewTemplateStart)}
					>
						{notePath ? (
							<RadioCard
								value="note"
								title={`This note — ${getNoteName(notePath)}`}
								description="Keeps its headings and properties. The text you wrote is left out."
							/>
						) : null}
						<RadioCard
							value="blank"
							title="A blank page"
							description="Start with a title and nothing else."
						/>
						{copyable.length > 0 ? (
							<RadioCard
								value="copy"
								title={copyName ? `A copy of ${copyName}` : "A copy of a template"}
								description="Duplicate a template you already have and change it."
							/>
						) : null}
					</RadioGroup>
					{start === "copy" && copyable.length > 1 ? (
						<NativeSelect
							aria-label="Template to copy"
							value={copyId}
							onChange={(event) => setCopyId(event.target.value)}
						>
							{copyable.map((template) => (
								<NativeSelectOption key={template.id} value={template.id}>
									{template.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					) : null}
				</div>
				<div className="template-new-field">
					<Label>New notes go to</Label>
					<FolderPicker
						options={folderOptions}
						value={folder}
						onChange={setFolder}
						placeholder="Vault root"
						allowCustomValue
					/>
				</div>
				{error ? <p className="template-picker-error">{error}</p> : null}
			</form>
			<DialogFooter className="template-new-foot">
				<Button variant="ghost" size="sm" onClick={() => newTemplateModal.close()}>
					Cancel
				</Button>
				<Button size="sm" disabled={!trimmedName || creating} onClick={() => void handleCreate()}>
					Create template
				</Button>
			</DialogFooter>
		</DialogContent>
	)
}
