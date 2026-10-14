import {
	applyDatabaseRowContent,
	noteCache,
	reportAppError,
	useCanWriteVaultPath,
	useWorkspaceStore,
} from "@cortex/core"
import { readOnlyDocumentExtension } from "@cortex/editor/collab"
import { EditorView } from "@cortex/editor/editor-view"
import type { EditorExtensionFactory, EditorRuntimeView } from "@cortex/editor/types"
import { createFrontmatterExtension } from "@cortex/properties/codemirror"
import type { DatabaseRow } from "@cortex/properties/database"
import {
	Button,
	Input,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Sheet,
	SheetContent,
	SheetTitle,
} from "@cortex/ui"
import {
	BookmarkPlusIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	Columns2Icon,
	ExternalLinkIcon,
	XIcon,
} from "lucide-react"
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { NotePropertiesPanel } from "../properties/NotePropertiesPanel"
import { NoteUnavailable } from "../split-view/NoteUnavailable"
import {
	createNoteCodeBlockEmbeds,
	resolveNoteImageUrl,
	useEditorConfig,
} from "../split-view/noteEditorAssets"
import { useNoteDocumentSession } from "../split-view/useNoteDocumentSession"
import { DatabaseTitleInput } from "./DatabaseTitleInput"

interface DatabasePeekProps {
	row: DatabaseRow
	position: number
	count: number
	onPrevious: () => void
	onNext: () => void
	onClose: () => void
	onSaveTemplate: (name: string) => Promise<void>
	onRename: (name: string) => Promise<unknown>
	databaseName: string
	container: HTMLElement | null
}

const PEEK_EXTENSIONS: EditorExtensionFactory[] = [createFrontmatterExtension()]
const READ_ONLY_PEEK_EXTENSIONS: EditorExtensionFactory[] = [
	createFrontmatterExtension(),
	readOnlyDocumentExtension,
]

function isEditableTarget(target: EventTarget | null): boolean {
	return (
		target instanceof Element &&
		Boolean(target.closest(".cm-editor, input, textarea, [contenteditable='true']"))
	)
}

function SaveTemplateButton({
	defaultName,
	onSave,
}: {
	defaultName: string
	onSave: (name: string) => Promise<void>
}) {
	const [open, setOpen] = useState(false)
	const [name, setName] = useState(defaultName)
	const submit = async (event: FormEvent) => {
		event.preventDefault()
		if (!name.trim()) return
		try {
			await onSave(name.trim())
			setOpen(false)
		} catch (error) {
			await reportAppError({
				operation: "database.save-template",
				source: "databases",
				cause: error,
				userMessage: "The template could not be saved.",
			})
		}
	}
	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next)
				if (next) setName(defaultName)
			}}
		>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label="Save as template">
					<BookmarkPlusIcon />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="db-filter-editor">
				<form className="db-filter-editor" onSubmit={submit}>
					<span className="db-filter-editor-label">Save as template</span>
					<Input
						size="sm"
						aria-label="Template name"
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
					<Button type="submit" size="xs">
						Save template
					</Button>
				</form>
			</PopoverContent>
		</Popover>
	)
}

export function DatabasePeek({
	row,
	position,
	count,
	onPrevious,
	onNext,
	onClose,
	onSaveTemplate,
	onRename,
	databaseName,
	container,
}: DatabasePeekProps) {
	const filePath = row.path
	const viewRef = useRef<EditorRuntimeView | null>(null)
	const editorConfig = useEditorConfig()
	const readOnly = !useCanWriteVaultPath(filePath)
	const { documentState, loadError, handleChange } = useNoteDocumentSession({
		filePath,
		isActive: false,
		mode: "live-preview",
		viewRef,
	})
	const codeBlockEmbeds = useMemo(() => createNoteCodeBlockEmbeds(filePath), [filePath])

	useEffect(() => {
		noteCache.openTab(filePath)
		const unsubscribe = noteCache.onContentChange(filePath, (path, content) =>
			applyDatabaseRowContent(path, content),
		)
		return () => {
			unsubscribe()
			void noteCache.closeTab(filePath)
		}
	}, [filePath])

	const openInTab = () => useWorkspaceStore.getState().openTab(filePath)
	const openToSide = () => {
		const workspace = useWorkspaceStore.getState()
		if (workspace.activePaneId)
			workspace.openInSplit(filePath, workspace.activePaneId, "horizontal")
	}

	return (
		<Sheet
			open
			modal={false}
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
		>
			<SheetContent
				side="right"
				variant="docked"
				container={container}
				showCloseButton={false}
				className="db-peek"
				aria-describedby={undefined}
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => event.preventDefault()}
				onInteractOutside={(event) => event.preventDefault()}
				onEscapeKeyDown={(event) => {
					if (isEditableTarget(event.target)) event.preventDefault()
				}}
			>
				<SheetTitle className="sr-only">{row.title}</SheetTitle>
				<div className="db-peek-bar">
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Previous note"
						disabled={position <= 1}
						onClick={onPrevious}
					>
						<ChevronUpIcon />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Next note"
						disabled={position >= count}
						onClick={onNext}
					>
						<ChevronDownIcon />
					</Button>
					{position > 0 && (
						<span className="db-peek-pos">
							{position} of {count}
						</span>
					)}
					<span className="flex-1" />
					{!readOnly && <SaveTemplateButton defaultName={row.title} onSave={onSaveTemplate} />}
					<Button variant="ghost" size="icon-sm" aria-label="Open in a new tab" onClick={openInTab}>
						<ExternalLinkIcon />
					</Button>
					<Button variant="ghost" size="icon-sm" aria-label="Open to the side" onClick={openToSide}>
						<Columns2Icon />
					</Button>
					<Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
						<XIcon />
					</Button>
				</div>
				<div className="db-peek-body">
					<div className="db-peek-path">
						{databaseName} / {row.title}.md
					</div>
					<div className="db-peek-heading">
						<DatabaseTitleInput
							value={row.title}
							label="Note title"
							className="note-header-title db-peek-title"
							readOnly={readOnly}
							autosize={false}
							onRename={onRename}
						/>
					</div>
					{documentState === null ? (
						loadError !== null ? (
							<NoteUnavailable filePath={filePath} message={loadError} />
						) : null
					) : (
						<>
							<NotePropertiesPanel
								filePath={filePath}
								projection={documentState.projection}
								readOnly={readOnly}
							/>
							<div className="note-document-surface">
								<EditorView
									key={`${filePath}:${readOnly ? "read-only" : "editable"}`}
									content={documentState.body}
									filePath={filePath}
									editorConfig={editorConfig}
									livePreview
									codeBlockEmbeds={codeBlockEmbeds}
									resolveImageUrl={resolveNoteImageUrl}
									extraExtensions={readOnly ? READ_ONLY_PEEK_EXTENSIONS : PEEK_EXTENSIONS}
									scrollMode="parent"
									onChange={handleChange}
									onViewReady={(view) => {
										viewRef.current = view
									}}
								/>
							</div>
						</>
					)}
				</div>
			</SheetContent>
		</Sheet>
	)
}
