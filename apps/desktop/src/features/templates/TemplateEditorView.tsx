import {
	noteTemplateShareKey,
	republishNoteTemplate,
	type TemplateDefinition,
	useTemplateStore,
	useVaultStore,
} from "@cortex/core"
import {
	createFileNamePattern,
	getFileNameParts,
	getTemplateValueGroups,
	getTemplateValueLabel,
	renderTemplate,
	renderTemplateValue,
	type TemplateRenderContext,
	type TemplateValueGroup,
} from "@cortex/core/templates"
import { createEditorConfig } from "@cortex/editor/editor-config"
import { EditorView } from "@cortex/editor/editor-view"
import { type SlashCommandMenuState, slashCommandExtension } from "@cortex/editor/slash-commands"
import type { EditorExtensionFactory, EditorRuntimeView } from "@cortex/editor/types"
import { parseFrontmatter, serializeFrontmatter } from "@cortex/properties"
import { useSettingsStore } from "@cortex/settings"
import {
	Alert,
	AlertDescription,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
	Empty,
	EmptyHeader,
	EmptyTitle,
	FolderPicker,
	Input,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
	Label,
	Spinner,
	Switch,
	Tag,
	Toggle,
	toast,
} from "@cortex/ui"
import {
	BracesIcon,
	InfoIcon,
	PencilIcon,
	PlayIcon,
	PlusIcon,
	Share2Icon,
	XIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { CoreViewProps } from "../split-view/coreViewProps"
import { SlashCommandMenu } from "../split-view/SlashCommandMenu"
import { cortexVimCommandProvider } from "../split-view/vimCommandProvider"
import { CustomValueDialog, type CustomValueDraft } from "./CustomValueDialog"
import { openShareTemplate } from "./shareActions"
import { retitleTemplateEditor } from "./templateActions"
import { refreshTemplateValueChips, templateValueChipsExtension } from "./templateValueChips"
import { useTemplateFolderOptions } from "./useTemplateFolderOptions"
import "./templates.css"
import { openCreateFromTemplate } from "@/utils/modals"

interface PropertyDraft {
	id: string
	key: string
	value: unknown
}

interface TemplateDraft {
	name: string
	description: string
	folder: string
	fileNamePattern: string
	askName: boolean
	properties: PropertyDraft[]
	body: string
	customValues: CustomValueDraft[]
}

const saveDelay = 450
const republishDelay = 5000
const exampleNoteTitle = "New note"
let draftRowId = 0

function nextRowId(): string {
	draftRowId += 1
	return `row-${draftRowId}`
}

function createDraft(template: TemplateDefinition, source: string): TemplateDraft {
	const { meta, body } = parseFrontmatter(source)
	return {
		name: template.name,
		description: template.description ?? "",
		folder: template.targetFolderPattern,
		fileNamePattern: template.fileNamePattern,
		askName: template.askName ?? true,
		properties: Object.entries(meta).map(([key, value]) => ({ id: nextRowId(), key, value })),
		body,
		customValues: Object.entries(template.customPlaceholders ?? {}).map(([name, expression]) => ({
			id: nextRowId(),
			name,
			expression,
		})),
	}
}

function serializeDraftBody(draft: TemplateDraft): string {
	const meta = Object.fromEntries(
		draft.properties
			.filter((property) => property.key.trim())
			.map((property) => [
				property.key.trim(),
				property.value === "" || property.value === undefined ? null : property.value,
			]),
	)
	return serializeFrontmatter(meta, draft.body)
}

function toCustomPlaceholders(values: CustomValueDraft[]): Record<string, string> | undefined {
	const entries = values.filter((value) => value.name.trim())
	if (entries.length === 0) return undefined
	return Object.fromEntries(entries.map((value) => [value.name.trim(), value.expression]))
}

function formatPropertyValue(value: unknown): string {
	if (value === null || value === undefined) return ""
	if (Array.isArray(value)) return value.map(formatPropertyValue).join(", ")
	if (typeof value === "object") return JSON.stringify(value)
	return String(value)
}

function getSingleToken(value: unknown): string | null {
	if (typeof value !== "string") return null
	const match = /^\s*\{\{\s*([^{}]+?)\s*\}\}\s*$/.exec(value)
	return match ? match[1].trim() : null
}

export function TemplateEditorView({ viewState }: CoreViewProps) {
	const templateId = typeof viewState.templateId === "string" ? viewState.templateId : null
	const vault = useVaultStore((state) => state.vault)
	const template = useTemplateStore((state) =>
		templateId ? state.templates.find((item) => item.id === templateId) : undefined,
	)
	const loaded = useTemplateStore((state) => state.loadedVaultPath === vault?.path)
	const ensureTemplatesLoaded = useTemplateStore((state) => state.ensureTemplatesLoaded)
	const readTemplateBody = useTemplateStore((state) => state.readTemplateBody)
	const [source, setSource] = useState<{ id: string; body: string } | null>(null)

	useEffect(() => {
		if (vault) void ensureTemplatesLoaded(vault)
	}, [ensureTemplatesLoaded, vault])

	const templateKey = template?.id
	useEffect(() => {
		if (!vault || !templateKey) return
		let cancelled = false
		void readTemplateBody(vault, templateKey).then((body) => {
			if (!cancelled) setSource({ id: templateKey, body })
		})
		return () => {
			cancelled = true
		}
	}, [readTemplateBody, templateKey, vault])

	if (!template) {
		return (
			<Empty className="h-full border-none">
				<EmptyHeader>
					{loaded ? <EmptyTitle>This template no longer exists</EmptyTitle> : <Spinner />}
				</EmptyHeader>
			</Empty>
		)
	}
	if (source?.id !== template.id) {
		return (
			<Empty className="h-full border-none">
				<Spinner />
			</Empty>
		)
	}
	return <TemplateEditorContent key={template.id} template={template} source={source.body} />
}

interface TemplateEditorContentProps {
	template: TemplateDefinition
	source: string
}

function TemplateEditorContent({ template, source }: TemplateEditorContentProps) {
	const vault = useVaultStore((state) => state.vault)
	const updateTemplate = useTemplateStore((state) => state.updateTemplate)
	const settings = useSettingsStore((state) => state.settings)
	const updateSetting = useSettingsStore((state) => state.updateSetting)
	const folderOptions = useTemplateFolderOptions()
	const [draft, setDraft] = useState<TemplateDraft>(() => createDraft(template, source))
	const [codeMode, setCodeMode] = useState(false)
	const [savedRevision, setSavedRevision] = useState(0)
	const [slashState, setSlashState] = useState<SlashCommandMenuState | null>(null)
	const viewRef = useRef<EditorRuntimeView | null>(null)
	const codeModeRef = useRef(codeMode)
	const firstRenderRef = useRef(true)
	const editorConfig = useMemo(
		() => ({ ...createEditorConfig(settings), showLineNumbers: false, folding: false }),
		[settings],
	)

	const context = useMemo<TemplateRenderContext>(
		() => ({
			now: new Date(),
			vault: { name: vault?.name ?? "Vault", path: vault?.path ?? "" },
			note: { title: exampleNoteTitle, folder: draft.folder },
			template: { id: template.id, name: draft.name },
			customPlaceholders: toCustomPlaceholders(draft.customValues),
		}),
		[draft.customValues, draft.folder, draft.name, template.id, vault?.name, vault?.path],
	)
	const contextRef = useRef(context)
	contextRef.current = context
	const valueGroups = useMemo(() => getTemplateValueGroups(context), [context])
	const valueGroupsRef = useRef<TemplateValueGroup[]>(valueGroups)
	valueGroupsRef.current = valueGroups

	const extensions = useMemo<EditorExtensionFactory[]>(
		() => [
			templateValueChipsExtension({
				isCodeMode: () => codeModeRef.current,
				describe: (expression) => renderTemplateValue(expression, contextRef.current),
			}),
			(runtime) =>
				slashCommandExtension(runtime, {
					trigger: "{{",
					getItems: () =>
						valueGroupsRef.current.flatMap((group) =>
							group.options.map((option) => ({
								id: option.expression,
								label: option.label,
								category: option.example || group.label,
								aliases: [option.expression],
							})),
						),
					insertText: (item) => `{{ ${item.id} }}`,
					onStateChange: setSlashState,
					onExecuteCommand: () => undefined,
				}),
		],
		[],
	)

	useEffect(() => {
		codeModeRef.current = codeMode
		refreshTemplateValueChips(viewRef.current)
	}, [codeMode])

	useEffect(() => {
		if (firstRenderRef.current) {
			firstRenderRef.current = false
			return
		}
		if (!vault) return
		const timer = window.setTimeout(() => {
			const name = draft.name.trim()
			updateTemplate(vault, template.id, {
				...(name ? { name } : {}),
				description: draft.description,
				targetFolderPattern: draft.folder,
				fileNamePattern: draft.fileNamePattern,
				askName: draft.askName,
				body: serializeDraftBody(draft),
				customPlaceholders: toCustomPlaceholders(draft.customValues) ?? {},
			})
				.then((saved) => {
					retitleTemplateEditor(saved.id, saved.name)
					setSavedRevision((revision) => revision + 1)
				})
				.catch((error: unknown) =>
					toast.error(error instanceof Error ? error.message : "The template could not be saved."),
				)
		}, saveDelay)
		return () => window.clearTimeout(timer)
	}, [draft, template.id, updateTemplate, vault])

	const shared = useTemplateStore((state) =>
		Boolean(state.shares[noteTemplateShareKey(template.id)]),
	)
	useEffect(() => {
		if (!vault || !shared || savedRevision === 0) return
		const timer = window.setTimeout(() => {
			void republishNoteTemplate(vault, template.id).catch(() => undefined)
		}, republishDelay)
		return () => window.clearTimeout(timer)
	}, [savedRevision, shared, template.id, vault])

	const update = (patch: Partial<TemplateDraft>) =>
		setDraft((current) => ({ ...current, ...patch }))

	const insertValue = (expression: string) => {
		const view = viewRef.current
		if (!view) {
			update({ body: `${draft.body}{{ ${expression} }}` })
			return
		}
		const insert = `{{ ${expression} }}`
		const { from, to } = view.state.selection.main
		view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length } })
		view.focus()
	}

	const nameParts = getFileNameParts(draft.fileNamePattern)
	const fileNameExample = (() => {
		try {
			const name = renderTemplate(draft.fileNamePattern, context).value.trim() || "Untitled"
			return `${draft.folder ? `${draft.folder} / ` : ""}${name}.md`
		} catch {
			return "Untitled.md"
		}
	})()
	const unusedOptions = valueGroups
		.flatMap((group) => group.options)
		.filter((option) => !nameParts?.includes(option.expression))

	return (
		<section className="template-editor">
			<div className="template-editor-doc">
				<div className="template-editor-docbar">
					<span className="template-editor-path">Templates / {draft.name || "Untitled"}</span>
					<span className="flex-1" />
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="secondary" size="xs">
								<BracesIcon />
								Insert value
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-64">
							{valueGroups.map((group, index) => (
								<DropdownMenuGroup key={group.id}>
									{index > 0 ? <DropdownMenuSeparator /> : null}
									<DropdownMenuLabel>{group.label}</DropdownMenuLabel>
									{group.options.map((option) => (
										<DropdownMenuItem
											key={option.expression}
											onSelect={() => insertValue(option.expression)}
										>
											{option.label}
											<DropdownMenuShortcut>{option.example}</DropdownMenuShortcut>
										</DropdownMenuItem>
									))}
								</DropdownMenuGroup>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
					<Toggle size="sm" pressed={codeMode} onPressedChange={setCodeMode}>
						{codeMode ? "Show preview" : "Show code"}
					</Toggle>
					<Button variant="ghost" size="xs" onClick={() => openShareTemplate(template.id)}>
						<Share2Icon />
						Share…
					</Button>
				</div>
				<div className="note-document-scroll template-editor-scroll">
					<div className="note-header template-editor-header">
						{settings.templates.editorHintDismissed ? null : (
							<div className="template-editor-block">
								<Alert className="template-editor-hint">
									<InfoIcon />
									<AlertDescription className="template-editor-hint-copy">
										<span>
											Write the note the way it should start. <b>Highlighted parts</b> are filled in
											each time, like today’s date. Type <code>{"{{"}</code> or use Insert value to
											add one.
										</span>
										<Button
											variant="ghost"
											size="xs"
											onClick={() => void updateSetting("templates", "editorHintDismissed", true)}
										>
											Got it
										</Button>
									</AlertDescription>
								</Alert>
							</div>
						)}
						<div className="note-header-title-group">
							<Input
								className="note-header-title"
								value={draft.name}
								placeholder="Template name"
								aria-label="Template name"
								spellCheck={false}
								onChange={(event) => update({ name: event.target.value })}
							/>
						</div>
					</div>
					<div className="template-editor-block">
						<PropertyRows
							properties={draft.properties}
							codeMode={codeMode}
							context={context}
							onChange={(properties) => update({ properties })}
						/>
					</div>
					<div className="note-document-surface template-editor-body">
						<EditorView
							content={draft.body}
							filePath={`template:${template.id}`}
							editorConfig={editorConfig}
							livePreview
							scrollMode="parent"
							extraExtensions={extensions}
							vimCommandProvider={editorConfig.vimMode ? cortexVimCommandProvider : null}
							onChange={(body) => update({ body })}
							onViewReady={(view) => {
								viewRef.current = view
							}}
						/>
					</div>
				</div>
			</div>
			<aside className="template-editor-side" aria-label="When someone uses it">
				<div className="template-editor-side-head">
					<b>When someone uses it</b>
					<small>What happens on New note from template</small>
				</div>
				<div className="template-editor-field">
					<Label>Folder</Label>
					<FolderPicker
						options={folderOptions}
						value={draft.folder}
						onChange={(folder) => update({ folder })}
						placeholder="Vault root"
						allowCustomValue
					/>
				</div>
				<div className="template-editor-field">
					<Label>Note name</Label>
					{nameParts && !codeMode ? (
						<div className="template-editor-chips">
							{nameParts.map((part) => (
								<Tag
									key={part}
									variant="active"
									removeLabel={`Remove ${getTemplateValueLabel(part)}`}
									onRemove={() =>
										update({
											fileNamePattern: createFileNamePattern(
												nameParts.filter((item) => item !== part),
											),
										})
									}
								>
									{getTemplateValueLabel(part)}
								</Tag>
							))}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="xs" disabled={unusedOptions.length === 0}>
										<PlusIcon />
										{nameParts.length === 0 ? "Add a value" : "Add"}
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" className="w-56">
									{unusedOptions.map((option) => (
										<DropdownMenuItem
											key={option.expression}
											onSelect={() =>
												update({
													fileNamePattern: createFileNamePattern([...nameParts, option.expression]),
												})
											}
										>
											{option.label}
											<DropdownMenuShortcut>{option.example}</DropdownMenuShortcut>
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					) : (
						<Input
							className="font-mono"
							value={draft.fileNamePattern}
							aria-label="Note name pattern"
							onChange={(event) => update({ fileNamePattern: event.target.value })}
						/>
					)}
					<p className="template-editor-example">
						For example <b>{fileNameExample}</b>
					</p>
				</div>
				<div className="template-editor-switch">
					<Label htmlFor="template-ask-name">Ask for a name when creating</Label>
					<Switch
						id="template-ask-name"
						size="sm"
						checked={draft.askName}
						onCheckedChange={(askName) => update({ askName })}
					/>
				</div>
				<div className="template-editor-field">
					<Label htmlFor="template-description">Description (shown in the picker)</Label>
					<Input
						id="template-description"
						value={draft.description}
						placeholder="What it’s for"
						onChange={(event) => update({ description: event.target.value })}
					/>
				</div>
				<CustomValues
					values={draft.customValues}
					context={context}
					onChange={(customValues) => update({ customValues })}
					onInsert={insertValue}
				/>
				<Button
					variant="secondary"
					className="self-start"
					onClick={() => openCreateFromTemplate(template.id)}
				>
					<PlayIcon />
					Try it
				</Button>
			</aside>
			<SlashCommandMenu
				state={slashState}
				emptyMessage="No values found"
				ItemIcon={ValueItemIcon}
			/>
		</section>
	)
}

function ValueItemIcon() {
	return (
		<span className="slash-command-icon" aria-hidden="true">
			<BracesIcon className="size-[15px]" />
		</span>
	)
}

interface PropertyRowsProps {
	properties: PropertyDraft[]
	codeMode: boolean
	context: TemplateRenderContext
	onChange: (properties: PropertyDraft[]) => void
}

function PropertyRows({ properties, codeMode, context, onChange }: PropertyRowsProps) {
	const setRow = (id: string, patch: Partial<PropertyDraft>) =>
		onChange(properties.map((row) => (row.id === id ? { ...row, ...patch } : row)))

	return (
		<div className="template-editor-props">
			{properties.map((row) => {
				const token = codeMode ? null : getSingleToken(row.value)
				return (
					<div key={row.id} className="template-editor-prop">
						<Input
							size="sm"
							className="template-editor-prop-key"
							value={row.key}
							placeholder="Property"
							aria-label="Property name"
							onChange={(event) => setRow(row.id, { key: event.target.value })}
						/>
						{token ? (
							<span className="template-editor-prop-value">
								<Tag
									variant="active"
									title={`Becomes ${renderTemplateValue(token, context)}`}
									removeLabel={`Remove ${getTemplateValueLabel(token)}`}
									onRemove={() => setRow(row.id, { value: "" })}
								>
									{getTemplateValueLabel(token)}
								</Tag>
							</span>
						) : (
							<Input
								size="sm"
								className="template-editor-prop-input"
								value={formatPropertyValue(row.value)}
								placeholder="Empty"
								aria-label={`${row.key || "Property"} value`}
								onChange={(event) => setRow(row.id, { value: event.target.value })}
							/>
						)}
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label={`Remove ${row.key || "property"}`}
							onClick={() => onChange(properties.filter((item) => item.id !== row.id))}
						>
							<XIcon />
						</Button>
					</div>
				)
			})}
			<Button
				variant="ghost"
				size="xs"
				className="self-start"
				onClick={() => onChange([...properties, { id: nextRowId(), key: "", value: "" }])}
			>
				<PlusIcon />
				Add property
			</Button>
		</div>
	)
}

interface CustomValuesProps {
	values: CustomValueDraft[]
	context: TemplateRenderContext
	onChange: (values: CustomValueDraft[]) => void
	onInsert: (expression: string) => void
}

function CustomValues({ values, context, onChange, onInsert }: CustomValuesProps) {
	const [editing, setEditing] = useState<CustomValueDraft | "new" | null>(null)
	const current = editing === "new" ? null : editing
	const save = (value: { name: string; expression: string }) => {
		if (current) {
			onChange(values.map((row) => (row.id === current.id ? { ...row, ...value } : row)))
		} else {
			onChange([...values, { id: nextRowId(), ...value }])
			onInsert(value.name)
		}
		setEditing(null)
	}

	return (
		<div className="template-editor-field">
			<div className="template-editor-field-head">
				<Label>Custom values</Label>
				<Button variant="ghost" size="xs" onClick={() => setEditing("new")}>
					<PlusIcon />
					New value
				</Button>
			</div>
			{values.length === 0 ? (
				<p className="template-editor-example">
					Make your own, like today’s date as 11/10/2026 or the note name in lowercase.
				</p>
			) : (
				<ItemGroup className="template-editor-custom-list">
					{values.map((row) => (
						<Item key={row.id} size="sm" variant="outline" className="template-editor-custom">
							<ItemContent>
								<ItemTitle>
									<Tag variant="active">{row.name || "Unnamed"}</Tag>
								</ItemTitle>
								<ItemDescription>
									{renderTemplateValue(row.name, context) || "(empty)"}
								</ItemDescription>
							</ItemContent>
							<ItemActions>
								<Button
									variant="ghost"
									size="icon-xs"
									aria-label={`Insert ${row.name}`}
									onClick={() => onInsert(row.name)}
								>
									<BracesIcon />
								</Button>
								<Button
									variant="ghost"
									size="icon-xs"
									aria-label={`Edit ${row.name}`}
									onClick={() => setEditing(row)}
								>
									<PencilIcon />
								</Button>
								<Button
									variant="ghost"
									size="icon-xs"
									aria-label={`Remove ${row.name}`}
									onClick={() => onChange(values.filter((item) => item.id !== row.id))}
								>
									<XIcon />
								</Button>
							</ItemActions>
						</Item>
					))}
				</ItemGroup>
			)}
			{editing ? (
				<CustomValueDialog
					value={current}
					takenNames={values.filter((row) => row.id !== current?.id).map((row) => row.name)}
					context={context}
					onSave={save}
					onClose={() => setEditing(null)}
				/>
			) : null}
		</div>
	)
}
