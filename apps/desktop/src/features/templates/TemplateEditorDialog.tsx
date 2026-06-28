import type { TemplateDefinition } from "@cortex/core"
import { useVaultStore } from "@cortex/core"
import { EditorView } from "@cortex/editor/editor-view"
import type { EditorRuntimeView } from "@cortex/editor/types"
import { useSettingsStore } from "@cortex/settings"
import {
	getDefaultTemplatePlaceholders,
	renderTemplateExpression,
	type TemplateRenderContext,
} from "@cortex/templates"
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	Label,
	Textarea,
} from "@cortex/ui"
import { PlusIcon, TestTube2Icon, VariableIcon, XIcon } from "lucide-react"
import { memo, useCallback, useMemo, useRef, useState } from "react"
import { cortexVimCommandProvider } from "../split-view/vimCommandProvider"
import { createTemplateEditorConfig } from "./templateEditorConfig"
import { createEmptyDraft, type TemplateEditorDraft } from "./templateEditorDraft"

interface TemplateEditorDialogProps {
	open: boolean
	template?: TemplateDefinition | null
	initialDraft: TemplateEditorDraft | null
	onOpenChange: (open: boolean) => void
	onSave: (draft: TemplateEditorDraft) => Promise<void>
}

interface CustomPlaceholderDraft {
	id: string
	name: string
	expression: string
}

interface TemplateEditorUiState {
	saving: boolean
	error: string | null
	testExpression: string
}

interface TemplatePlaceholder {
	name: string
	label: string
	description: string
	example: string
}

interface TemplateTestResult {
	value: string
	error: string | null
}

interface TemplateTokenRailProps {
	templateName: string
	description: string
	targetFolderPattern: string
	placeholders: TemplatePlaceholder[]
	customPlaceholderRows: CustomPlaceholderDraft[]
	testExpression: string
	testResult: TemplateTestResult
	onInsertPlaceholder: (name: string) => void
	onNameChange: (name: string) => void
	onDescriptionChange: (description: string) => void
	onTargetFolderPatternChange: (targetFolderPattern: string) => void
	onAddCustomPlaceholder: () => void
	onCustomPlaceholderNameChange: (rowId: string, name: string) => void
	onCustomPlaceholderExpressionChange: (rowId: string, expression: string) => void
	onRemoveCustomPlaceholder: (rowId: string) => void
	onTestExpressionChange: (testExpression: string) => void
}

type TemplateInsertionTarget = "body" | "title"

function createCustomPlaceholderRows(
	customPlaceholders: Record<string, string>,
): CustomPlaceholderDraft[] {
	return Object.entries(customPlaceholders).map(([name, expression], index) => ({
		id: `custom-${index}`,
		name,
		expression,
	}))
}

function createCustomPlaceholders(rows: CustomPlaceholderDraft[]): Record<string, string> {
	return Object.fromEntries(
		rows.flatMap((row) => {
			const name = row.name.trim()
			return name ? [[name, row.expression] as const] : []
		}),
	)
}

function createPreviewContext(
	draft: Pick<TemplateEditorDraft, "customPlaceholders" | "id" | "name">,
	vaultName: string,
	vaultPath: string,
): TemplateRenderContext {
	return {
		now: new Date(),
		vault: {
			name: vaultName || "Vault",
			path: vaultPath || "/vault",
		},
		template: {
			id: draft.id ?? "draft",
			name: draft.name || "Template",
		},
		note: {
			title: "Project Plan",
			fileName: "project-plan.md",
			folder: "Projects",
		},
		customPlaceholders: draft.customPlaceholders,
	}
}

function renderPlaceholderExample(name: string, context: TemplateRenderContext): string {
	try {
		return renderTemplateExpression(name, context)
	} catch {
		return "Invalid"
	}
}

const TemplateTokenRail = memo(function TemplateTokenRail({
	templateName,
	description,
	targetFolderPattern,
	placeholders,
	customPlaceholderRows,
	testExpression,
	testResult,
	onInsertPlaceholder,
	onNameChange,
	onDescriptionChange,
	onTargetFolderPatternChange,
	onAddCustomPlaceholder,
	onCustomPlaceholderNameChange,
	onCustomPlaceholderExpressionChange,
	onRemoveCustomPlaceholder,
	onTestExpressionChange,
}: TemplateTokenRailProps) {
	return (
		<aside className="template-token-rail flex min-h-0 flex-col gap-4 overflow-y-auto border-l border-border bg-bg-secondary/45 p-4 max-lg:hidden">
			<div className="flex flex-col gap-3">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="template-name">Template name</Label>
					<Input
						id="template-name"
						value={templateName}
						onChange={(event) => onNameChange(event.target.value)}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="template-description">Description</Label>
					<Textarea
						id="template-description"
						value={description}
						className="min-h-16"
						onChange={(event) => onDescriptionChange(event.target.value)}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="template-folder">Folder</Label>
						<Input
							id="template-folder"
							placeholder="Daily"
							value={targetFolderPattern}
							onChange={(event) => onTargetFolderPatternChange(event.target.value)}
						/>
					</div>
				</div>
			</div>
			<div className="h-px shrink-0 bg-border" />
			<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
				<VariableIcon className="size-3.5" />
				Tokens
			</div>
			<div className="flex flex-wrap gap-1.5">
				{placeholders.map((placeholder) => (
					<Button
						key={placeholder.name}
						type="button"
						variant="outline"
						size="xs"
						className="max-w-full justify-start rounded-[7px] font-mono"
						title={placeholder.example}
						onClick={() => onInsertPlaceholder(placeholder.name)}
					>
						<span className="truncate">{placeholder.name}</span>
					</Button>
				))}
			</div>
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-2">
					<span className="text-xs font-medium text-foreground">Custom</span>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						aria-label="Add custom token"
						onClick={onAddCustomPlaceholder}
					>
						<PlusIcon />
					</Button>
				</div>
				<div className="flex flex-col gap-2">
					{customPlaceholderRows.map((row) => (
						<div
							key={row.id}
							className="rounded-[8px] border border-border/70 bg-bg-primary/60 p-2"
						>
							<div className="mb-2 flex items-center gap-1.5">
								<Input
									size="sm"
									value={row.name}
									onChange={(event) => onCustomPlaceholderNameChange(row.id, event.target.value)}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									aria-label={`Remove ${row.name || "custom token"}`}
									onClick={() => onRemoveCustomPlaceholder(row.id)}
								>
									<XIcon />
								</Button>
							</div>
							<Textarea
								value={row.expression}
								onChange={(event) =>
									onCustomPlaceholderExpressionChange(row.id, event.target.value)
								}
								className="min-h-14 font-mono"
							/>
						</div>
					))}
				</div>
			</div>
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-2 text-xs font-medium text-foreground">
					<TestTube2Icon className="size-3.5" />
					Test
				</div>
				<InputGroup>
					<InputGroupAddon>
						<span className="font-mono text-xs">{"{{"}</span>
					</InputGroupAddon>
					<InputGroupInput
						value={testExpression}
						onChange={(event) => onTestExpressionChange(event.target.value)}
						className="font-mono"
					/>
					<InputGroupAddon align="inline-end">
						<span className="font-mono text-xs">{"}}"}</span>
					</InputGroupAddon>
				</InputGroup>
				<div className="min-h-8 rounded-[8px] border border-border/70 bg-bg-primary/60 px-2 py-1.5 text-xs">
					{testResult.error ? (
						<span className="text-destructive">{testResult.error}</span>
					) : (
						<span className="font-mono text-muted-foreground">{testResult.value}</span>
					)}
				</div>
			</div>
		</aside>
	)
})

export function TemplateEditorDialog({
	open,
	template,
	initialDraft,
	onOpenChange,
	onSave,
}: TemplateEditorDialogProps) {
	const contentKey = initialDraft?.id ?? template?.id ?? "new-template"
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{open && (
				<TemplateEditorDialogContent
					key={contentKey}
					template={template}
					initialDraft={initialDraft}
					onOpenChange={onOpenChange}
					onSave={onSave}
				/>
			)}
		</Dialog>
	)
}

function TemplateEditorDialogContent({
	template,
	initialDraft,
	onOpenChange,
	onSave,
}: Omit<TemplateEditorDialogProps, "open">) {
	const settings = useSettingsStore((state) => state.settings)
	const vault = useVaultStore((state) => state.vault)
	const initialTemplateDraft = initialDraft ?? createEmptyDraft()
	const [draft, setDraft] = useState<TemplateEditorDraft>(() => initialTemplateDraft)
	const [customPlaceholderRows, setCustomPlaceholderRows] = useState<CustomPlaceholderDraft[]>(() =>
		createCustomPlaceholderRows(initialTemplateDraft.customPlaceholders),
	)
	const [uiState, setUiState] = useState<TemplateEditorUiState>({
		saving: false,
		error: null,
		testExpression: "date.today",
	})
	const customPlaceholderIdRef = useRef(customPlaceholderRows.length)
	const insertionTargetRef = useRef<TemplateInsertionTarget>("body")
	const titlePatternInputRef = useRef<HTMLInputElement | null>(null)
	const viewRef = useRef<EditorRuntimeView | null>(null)
	const { saving, error, testExpression } = uiState
	const draftId = draft.id
	const draftName = draft.name
	const draftCustomPlaceholders = draft.customPlaceholders

	const editorConfig = useMemo(() => createTemplateEditorConfig(settings), [settings])

	const previewContext = useMemo(
		() =>
			createPreviewContext(
				{
					id: draftId,
					name: draftName,
					customPlaceholders: draftCustomPlaceholders,
				},
				vault?.name ?? "Vault",
				vault?.path ?? "/vault",
			),
		[draftCustomPlaceholders, draftId, draftName, vault?.name, vault?.path],
	)

	const placeholders = useMemo(() => {
		const defaults = getDefaultTemplatePlaceholders(previewContext)
		const custom = Object.keys(draft.customPlaceholders).map((name) => ({
			name,
			label: name,
			description: "Custom placeholder.",
			example: renderPlaceholderExample(name, previewContext),
		}))
		return [...defaults, ...custom]
	}, [draft.customPlaceholders, previewContext])

	const testResult = useMemo(() => {
		try {
			return { value: renderTemplateExpression(testExpression, previewContext), error: null }
		} catch (testError) {
			return {
				value: "",
				error: testError instanceof Error ? testError.message : String(testError),
			}
		}
	}, [previewContext, testExpression])

	const handleInsertTitlePlaceholder = useCallback((name: string) => {
		const insert = `{{ ${name} }}`
		setDraft((current) => {
			const input = titlePatternInputRef.current
			const from = input?.selectionStart ?? current.fileNamePattern.length
			const to = input?.selectionEnd ?? from
			const fileNamePattern = `${current.fileNamePattern.slice(0, from)}${insert}${current.fileNamePattern.slice(to)}`
			const restoreSelection = () => {
				input?.focus()
				input?.setSelectionRange(from + insert.length, from + insert.length)
			}
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(restoreSelection)
			else setTimeout(restoreSelection, 0)
			return { ...current, fileNamePattern }
		})
	}, [])

	const handleInsertPlaceholder = useCallback(
		(name: string) => {
			if (insertionTargetRef.current === "title") {
				handleInsertTitlePlaceholder(name)
				return
			}
			const view = viewRef.current
			if (!view) return
			const insert = `{{ ${name} }}`
			const { from, to } = view.state.selection.main
			view.dispatch({
				changes: { from, to, insert },
				selection: { anchor: from + insert.length },
			})
			view.focus()
		},
		[handleInsertTitlePlaceholder],
	)

	const handleBodyChange = useCallback((body: string) => {
		setDraft((current) => ({ ...current, body }))
	}, [])

	const handleViewReady = useCallback((view: EditorRuntimeView) => {
		viewRef.current = view
	}, [])

	const handleNameChange = useCallback((name: string) => {
		setDraft((current) => ({ ...current, name }))
	}, [])

	const handleDescriptionChange = useCallback((description: string) => {
		setDraft((current) => ({ ...current, description }))
	}, [])

	const handleTargetFolderPatternChange = useCallback((targetFolderPattern: string) => {
		setDraft((current) => ({ ...current, targetFolderPattern }))
	}, [])

	const handleFileNamePatternChange = useCallback((fileNamePattern: string) => {
		setDraft((current) => ({ ...current, fileNamePattern }))
	}, [])

	const handleTestExpressionChange = useCallback((testExpression: string) => {
		setUiState((current) => ({ ...current, testExpression }))
	}, [])

	const updateCustomPlaceholderRows = useCallback(
		(updater: (rows: CustomPlaceholderDraft[]) => CustomPlaceholderDraft[]) => {
			setCustomPlaceholderRows((currentRows) => {
				const nextRows = updater(currentRows)
				setDraft((current) => ({
					...current,
					customPlaceholders: createCustomPlaceholders(nextRows),
				}))
				return nextRows
			})
		},
		[],
	)

	const handleCustomPlaceholderNameChange = useCallback(
		(rowId: string, name: string) => {
			updateCustomPlaceholderRows((rows) =>
				rows.map((row) => (row.id === rowId ? { ...row, name } : row)),
			)
		},
		[updateCustomPlaceholderRows],
	)

	const handleCustomPlaceholderExpressionChange = useCallback(
		(rowId: string, expression: string) => {
			updateCustomPlaceholderRows((rows) =>
				rows.map((row) => (row.id === rowId ? { ...row, expression } : row)),
			)
		},
		[updateCustomPlaceholderRows],
	)

	const handleRemoveCustomPlaceholder = useCallback(
		(rowId: string) => {
			updateCustomPlaceholderRows((rows) => rows.filter((row) => row.id !== rowId))
		},
		[updateCustomPlaceholderRows],
	)

	const handleAddCustomPlaceholder = useCallback(() => {
		updateCustomPlaceholderRows((rows) => {
			let index = rows.length + 1
			let name = `custom.${index}`
			const existingNames = new Set(rows.map((row) => row.name))
			while (existingNames.has(name)) {
				index++
				name = `custom.${index}`
			}
			customPlaceholderIdRef.current += 1
			return [
				...rows,
				{
					id: `custom-${customPlaceholderIdRef.current}`,
					name,
					expression: "note.title | slug",
				},
			]
		})
	}, [updateCustomPlaceholderRows])

	const handleSave = useCallback(async () => {
		setUiState((current) => ({ ...current, saving: true, error: null }))
		try {
			await onSave({
				...draft,
				customPlaceholders: createCustomPlaceholders(customPlaceholderRows),
			})
			onOpenChange(false)
		} catch (saveError) {
			setUiState((current) => ({
				...current,
				error: saveError instanceof Error ? saveError.message : String(saveError),
			}))
		} finally {
			setUiState((current) => ({ ...current, saving: false }))
		}
	}, [customPlaceholderRows, draft, onOpenChange, onSave])

	return (
		<DialogContent className="template-editor-dialog-content flex flex-col gap-0 overflow-hidden p-0">
			<DialogHeader className="dialog-chrome-header">
				<DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
				<DialogDescription>{draft.name || "Template"}</DialogDescription>
			</DialogHeader>
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] overflow-hidden max-lg:grid-cols-1">
				<div className="flex min-h-0 flex-col overflow-hidden bg-bg-primary">
					<div className="shrink-0 border-b border-border px-8 py-5">
						<div className="flex min-w-0 flex-col gap-1.5">
							<Label
								htmlFor="template-note-title-pattern"
								className="text-xs uppercase tracking-[0.08em] text-muted-foreground"
							>
								Note title
							</Label>
							<Input
								id="template-note-title-pattern"
								ref={titlePatternInputRef}
								value={draft.fileNamePattern}
								placeholder="{{ note.title | slug }}"
								className="template-note-title-input font-mono"
								onFocus={() => {
									insertionTargetRef.current = "title"
								}}
								onChange={(event) => handleFileNamePatternChange(event.target.value)}
							/>
						</div>
					</div>
					<div
						className="min-h-0 flex-1 overflow-hidden bg-bg-primary"
						onPointerDown={() => {
							insertionTargetRef.current = "body"
						}}
					>
						<EditorView
							content={draft.body}
							filePath={`template:${draft.id ?? "draft"}`}
							editorConfig={editorConfig}
							livePreview={false}
							vimCommandProvider={editorConfig.vimMode ? cortexVimCommandProvider : null}
							onChange={handleBodyChange}
							onViewReady={handleViewReady}
						/>
					</div>
				</div>
				<TemplateTokenRail
					templateName={draft.name}
					description={draft.description}
					targetFolderPattern={draft.targetFolderPattern}
					placeholders={placeholders}
					customPlaceholderRows={customPlaceholderRows}
					testExpression={testExpression}
					testResult={testResult}
					onInsertPlaceholder={handleInsertPlaceholder}
					onNameChange={handleNameChange}
					onDescriptionChange={handleDescriptionChange}
					onTargetFolderPatternChange={handleTargetFolderPatternChange}
					onAddCustomPlaceholder={handleAddCustomPlaceholder}
					onCustomPlaceholderNameChange={handleCustomPlaceholderNameChange}
					onCustomPlaceholderExpressionChange={handleCustomPlaceholderExpressionChange}
					onRemoveCustomPlaceholder={handleRemoveCustomPlaceholder}
					onTestExpressionChange={handleTestExpressionChange}
				/>
			</div>
			{error && (
				<div className="border-t border-border px-5 py-2 text-sm text-destructive">{error}</div>
			)}
			<DialogFooter className="dialog-chrome-footer">
				<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
					Cancel
				</Button>
				<Button type="button" disabled={saving} onClick={handleSave}>
					{saving ? "Saving" : "Save template"}
				</Button>
			</DialogFooter>
		</DialogContent>
	)
}
