import {
	useCanWriteVaultPath,
	useTemplateStore,
	useUIStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import {
	Button,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	NativeSelect,
	NativeSelectOption,
	Textarea,
} from "@cortex/ui"
import { LayoutTemplateIcon, SettingsIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useReducer } from "react"
import { ModalHost } from "@/utils/ModalHost"

interface TemplatePreviewState {
	targetFolder: string
	fileName: string
	content: string
}

interface CreateFromTemplateState {
	templateId: string
	noteTitle: string
	targetFolder: string
	fileName: string
	contentPreview: string
	error: string | null
	creating: boolean
}

type CreateFromTemplateField = "templateId" | "noteTitle" | "targetFolder" | "fileName"

type CreateFromTemplateAction =
	| { type: "fieldChanged"; field: CreateFromTemplateField; value: string }
	| { type: "previewResolved"; preview: TemplatePreviewState; includeLocation: boolean }
	| { type: "previewRejected"; error: string }
	| { type: "createStarted" }
	| { type: "createFailed"; error: string }
	| { type: "createFinished" }

const initialCreateFromTemplateState: CreateFromTemplateState = {
	templateId: "",
	noteTitle: "",
	targetFolder: "",
	fileName: "",
	contentPreview: "",
	error: null,
	creating: false,
}

function createFromTemplateReducer(
	state: CreateFromTemplateState,
	action: CreateFromTemplateAction,
): CreateFromTemplateState {
	switch (action.type) {
		case "fieldChanged":
			return { ...state, [action.field]: action.value }
		case "previewResolved":
			return {
				...state,
				targetFolder: action.includeLocation ? action.preview.targetFolder : state.targetFolder,
				fileName: action.includeLocation ? action.preview.fileName : state.fileName,
				contentPreview: action.preview.content,
				error: null,
			}
		case "previewRejected":
			return { ...state, error: action.error }
		case "createStarted":
			return { ...state, creating: true, error: null }
		case "createFailed":
			return { ...state, creating: false, error: action.error }
		case "createFinished":
			return { ...state, creating: false }
	}
}

export function CreateFromTemplateDialog() {
	const open = useUIStore((state) => state.createFromTemplateOpen)
	const closeCreateFromTemplate = useUIStore((state) => state.closeCreateFromTemplate)

	return (
		<ModalHost open={open} onOpenChange={(nextOpen) => !nextOpen && closeCreateFromTemplate()}>
			<CreateFromTemplateContent />
		</ModalHost>
	)
}

function CreateFromTemplateContent() {
	const vault = useVaultStore((state) => state.vault)
	const refreshFiles = useVaultStore((state) => state.refreshFiles)
	const templates = useTemplateStore((state) => state.templates)
	const ensureTemplatesLoaded = useTemplateStore((state) => state.ensureTemplatesLoaded)
	const previewNoteFromTemplate = useTemplateStore((state) => state.previewNoteFromTemplate)
	const createNoteFromTemplate = useTemplateStore((state) => state.createNoteFromTemplate)
	const openTab = useWorkspaceStore((state) => state.openTab)
	const closeCreateFromTemplate = useUIStore((state) => state.closeCreateFromTemplate)
	const openSettings = useUIStore((state) => state.openSettings)
	const [state, dispatch] = useReducer(createFromTemplateReducer, initialCreateFromTemplateState)
	const { templateId, noteTitle, targetFolder, fileName, contentPreview, error, creating } = state
	const targetFolderWritable = useCanWriteVaultPath(
		vault ? (targetFolder.trim() ? `${vault.path}/${targetFolder.trim()}` : vault.path) : null,
		true,
	)

	const selectedTemplate = useMemo(
		() => templates.find((template) => template.id === templateId) ?? templates[0],
		[templateId, templates],
	)

	useEffect(() => {
		if (vault) ensureTemplatesLoaded(vault)
	}, [ensureTemplatesLoaded, vault])

	useEffect(() => {
		if (!vault || !selectedTemplate) return
		let cancelled = false
		previewNoteFromTemplate(vault, {
			templateId: selectedTemplate.id,
			noteTitle,
		})
			.then((preview) => {
				if (cancelled) return
				dispatch({ type: "previewResolved", preview, includeLocation: true })
			})
			.catch((previewError) => {
				if (!cancelled) {
					dispatch({
						type: "previewRejected",
						error: previewError instanceof Error ? previewError.message : String(previewError),
					})
				}
			})
		return () => {
			cancelled = true
		}
	}, [noteTitle, previewNoteFromTemplate, selectedTemplate, vault])

	useEffect(() => {
		if (!vault || !selectedTemplate || !fileName) return
		let cancelled = false
		previewNoteFromTemplate(vault, {
			templateId: selectedTemplate.id,
			noteTitle,
			targetFolder,
			fileName,
		})
			.then((preview) => {
				if (cancelled) return
				dispatch({ type: "previewResolved", preview, includeLocation: false })
			})
			.catch((previewError) => {
				if (!cancelled) {
					dispatch({
						type: "previewRejected",
						error: previewError instanceof Error ? previewError.message : String(previewError),
					})
				}
			})
		return () => {
			cancelled = true
		}
	}, [fileName, noteTitle, previewNoteFromTemplate, selectedTemplate, targetFolder, vault])

	const handleCreate = useCallback(async () => {
		if (!vault || !selectedTemplate) return
		dispatch({ type: "createStarted" })
		try {
			const filePath = await createNoteFromTemplate(vault, {
				templateId: selectedTemplate.id,
				noteTitle,
				targetFolder,
				fileName,
			})
			await refreshFiles()
			openTab(filePath)
			closeCreateFromTemplate()
		} catch (createError) {
			dispatch({
				type: "createFailed",
				error: createError instanceof Error ? createError.message : String(createError),
			})
		} finally {
			dispatch({ type: "createFinished" })
		}
	}, [
		closeCreateFromTemplate,
		createNoteFromTemplate,
		fileName,
		noteTitle,
		openTab,
		refreshFiles,
		selectedTemplate,
		targetFolder,
		vault,
	])

	return (
		<DialogContent className="create-from-template-dialog-content overflow-hidden p-0">
			<DialogHeader className="dialog-chrome-header">
				<DialogTitle>New note from template</DialogTitle>
				<DialogDescription>{selectedTemplate?.name ?? "Templates"}</DialogDescription>
			</DialogHeader>
			<div className="grid gap-4 p-5">
				{templates.length === 0 ? (
					<div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-[8px] border border-border bg-bg-secondary/45 p-5 text-center">
						<LayoutTemplateIcon className="size-8 text-muted-foreground" />
						<div className="text-sm text-muted-foreground">No templates yet.</div>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								closeCreateFromTemplate()
								openSettings("templates")
							}}
						>
							<SettingsIcon />
							Manage templates
						</Button>
					</div>
				) : (
					<>
						<div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="create-template-select">Template</Label>
								<NativeSelect
									id="create-template-select"
									value={selectedTemplate?.id ?? ""}
									onChange={(event) =>
										dispatch({
											type: "fieldChanged",
											field: "templateId",
											value: event.target.value,
										})
									}
								>
									{templates.map((template) => (
										<NativeSelectOption key={template.id} value={template.id}>
											{template.name}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="template-note-title">Note title</Label>
								<Input
									id="template-note-title"
									value={noteTitle}
									placeholder={selectedTemplate?.name ?? "Untitled"}
									onChange={(event) =>
										dispatch({
											type: "fieldChanged",
											field: "noteTitle",
											value: event.target.value,
										})
									}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="template-target-folder">Folder</Label>
								<Input
									id="template-target-folder"
									value={targetFolder}
									onChange={(event) =>
										dispatch({
											type: "fieldChanged",
											field: "targetFolder",
											value: event.target.value,
										})
									}
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="template-file-name">Saved title</Label>
								<Input
									id="template-file-name"
									value={fileName}
									onChange={(event) =>
										dispatch({
											type: "fieldChanged",
											field: "fileName",
											value: event.target.value,
										})
									}
								/>
							</div>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="template-preview">Preview</Label>
							<Textarea
								id="template-preview"
								readOnly
								value={contentPreview}
								className="max-h-[240px] min-h-36 overflow-auto font-mono"
							/>
						</div>
					</>
				)}
				{error && <div className="text-sm text-destructive">{error}</div>}
				{!error && !targetFolderWritable && (
					<div className="text-sm text-destructive">
						You only have view access to this folder. Choose another folder.
					</div>
				)}
			</div>
			<DialogFooter className="dialog-chrome-footer">
				<Button type="button" variant="outline" onClick={closeCreateFromTemplate}>
					Cancel
				</Button>
				{templates.length > 0 && (
					<Button
						type="button"
						disabled={creating || Boolean(error) || !targetFolderWritable}
						onClick={handleCreate}
					>
						{creating ? "Creating" : "Create note"}
					</Button>
				)}
			</DialogFooter>
		</DialogContent>
	)
}
