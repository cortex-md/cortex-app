import {
	type TemplateDefinition,
	useCanWriteVaultPath,
	useTemplateStore,
	useUIStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import {
	Button,
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
	DialogContent,
	DialogTitle,
	FolderPicker,
	Input,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	Kbd,
} from "@cortex/ui"
import {
	FileIcon,
	LayoutTemplateIcon,
	PlusIcon,
	SearchIcon,
	Settings2Icon,
	StoreIcon,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { ModalHost } from "@/utils/ModalHost"
import { openMarketplaceView } from "../marketplace/openMarketplaceView"
import { TemplateNotePreview } from "./TemplateNotePreview"
import { openNewTemplate, openTemplatesView } from "./templateActions"
import { getTemplateGroups } from "./templateGroups"
import { useTemplateFolderOptions } from "./useTemplateFolderOptions"
import "./templates.css"

const BLANK_KEY = "__blank__"

interface PreviewState {
	key: string
	content: string
	folder: string
	error: string | null
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

function useTemplatePreview(templateId: string | null, title: string): PreviewState | null {
	const vault = useVaultStore((state) => state.vault)
	const previewNoteFromTemplate = useTemplateStore((state) => state.previewNoteFromTemplate)
	const [preview, setPreview] = useState<PreviewState | null>(null)

	useEffect(() => {
		if (!vault || !templateId) return
		let cancelled = false
		previewNoteFromTemplate(vault, { templateId, noteTitle: title })
			.then((result) => {
				if (!cancelled) {
					setPreview({
						key: templateId,
						content: result.content,
						folder: result.targetFolder,
						error: null,
					})
				}
			})
			.catch((previewError: unknown) => {
				if (!cancelled) {
					setPreview({
						key: templateId,
						content: "",
						folder: "",
						error: previewError instanceof Error ? previewError.message : String(previewError),
					})
				}
			})
		return () => {
			cancelled = true
		}
	}, [previewNoteFromTemplate, templateId, title, vault])

	return preview?.key === templateId ? preview : null
}

interface PickerLinksProps {
	activeTemplateId: string | undefined
}

function PickerLinks({ activeTemplateId }: PickerLinksProps) {
	const closeCreateFromTemplate = useUIStore((state) => state.closeCreateFromTemplate)
	const run = (action: () => void) => () => {
		closeCreateFromTemplate()
		action()
	}
	return (
		<div className="template-picker-more">
			<Button variant="ghost" size="xs" onClick={run(() => openNewTemplate({ start: "blank" }))}>
				<PlusIcon />
				New template
			</Button>
			<Button variant="ghost" size="xs" onClick={run(() => openTemplatesView(activeTemplateId))}>
				<Settings2Icon />
				Manage templates
			</Button>
			<Button variant="ghost" size="xs" onClick={run(() => openMarketplaceView("templates"))}>
				<StoreIcon />
				Find more in Marketplace
			</Button>
		</div>
	)
}

interface PickerFooterProps {
	folder: string
	error: string | null
	creating: boolean
	onFolderChange: (folder: string) => void
	onCreate: () => void
}

function PickerFooter({ folder, error, creating, onFolderChange, onCreate }: PickerFooterProps) {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const folderOptions = useTemplateFolderOptions()
	const folderWritable = useCanWriteVaultPath(
		vaultPath ? (folder.trim() ? `${vaultPath}/${folder.trim()}` : vaultPath) : null,
		true,
	)
	const message =
		error ??
		(folderWritable ? null : "You only have view access to this folder. Choose another folder.")
	return (
		<div className="template-picker-foot">
			<div className="template-picker-folder">
				<FolderPicker
					options={folderOptions}
					value={folder}
					onChange={onFolderChange}
					placeholder="Vault root"
					allowCustomValue
				/>
			</div>
			{message ? <span className="template-picker-error">{message}</span> : null}
			<span className="flex-1" />
			<Button size="sm" disabled={creating || Boolean(message)} onClick={onCreate}>
				{creating ? "Opening…" : "Create note"}
				<Kbd>↵</Kbd>
			</Button>
		</div>
	)
}

function CreateFromTemplateContent() {
	const vault = useVaultStore((state) => state.vault)
	const refreshFiles = useVaultStore((state) => state.refreshFiles)
	const createFile = useVaultStore((state) => state.createFile)
	const templates = useTemplateStore((state) => state.templates)
	const ensureTemplatesLoaded = useTemplateStore((state) => state.ensureTemplatesLoaded)
	const createNoteFromTemplate = useTemplateStore((state) => state.createNoteFromTemplate)
	const initialTemplateId = useUIStore((state) => state.createFromTemplateId)
	const closeCreateFromTemplate = useUIStore((state) => state.closeCreateFromTemplate)
	const openTab = useWorkspaceStore((state) => state.openTab)
	const showTeam = useSettingsStore((state) => state.settings.templates.showTeam)
	const [query, setQuery] = useState("")
	const [selectedKey, setSelectedKey] = useState<string>(initialTemplateId ?? "")
	const [titles, setTitles] = useState<Record<string, string>>({})
	const [folders, setFolders] = useState<Record<string, string>>({})
	const [creating, setCreating] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (vault) void ensureTemplatesLoaded(vault)
	}, [ensureTemplatesLoaded, vault])

	const groups = useMemo(
		() => getTemplateGroups(templates, { includeRecent: true, showTeam, query }),
		[query, showTeam, templates],
	)
	const visibleKeys = useMemo(
		() => [...groups.flatMap((group) => group.templates.map((template) => template.id)), BLANK_KEY],
		[groups],
	)
	const activeKey = visibleKeys.includes(selectedKey) ? selectedKey : visibleKeys[0]
	const activeTemplate: TemplateDefinition | undefined = templates.find(
		(template) => template.id === activeKey,
	)
	const blankLabel = query.trim() ? `Blank note “${query.trim()}”` : "Blank note"
	const title = titles[activeKey] ?? (activeKey === BLANK_KEY ? query.trim() : "")
	const resolvedPreview = useTemplatePreview(activeTemplate?.id ?? null, title)
	const folder = folders[activeKey] ?? resolvedPreview?.folder ?? ""

	const handleCreate = async () => {
		if (!vault || creating) return
		setCreating(true)
		setError(null)
		try {
			const targetFolder = folder.trim()
			const parentPath = targetFolder ? `${vault.path}/${targetFolder}` : vault.path
			const filePath = activeTemplate
				? await createNoteFromTemplate(vault, {
						templateId: activeTemplate.id,
						noteTitle: title,
						targetFolder,
					})
				: await createFile(parentPath, title.trim() || "Untitled")
			await refreshFiles()
			openTab(filePath)
			closeCreateFromTemplate()
		} catch (createError) {
			setError(createError instanceof Error ? createError.message : String(createError))
			setCreating(false)
		}
	}

	return (
		<DialogContent
			className="template-picker overflow-hidden p-0"
			showCloseButton={false}
			aria-describedby={undefined}
		>
			<DialogTitle className="sr-only">New note from template</DialogTitle>
			<Command
				className="template-picker-command"
				shouldFilter={false}
				value={activeKey}
				onValueChange={setSelectedKey}
			>
				<div className="template-picker-find">
					<InputGroup variant="search">
						<InputGroupAddon>
							<SearchIcon />
						</InputGroupAddon>
						<InputGroupInput
							autoFocus
							value={query}
							placeholder="New note from template…"
							aria-label="Find a template"
							onChange={(event) => setQuery(event.target.value)}
						/>
					</InputGroup>
				</div>
				<div className="template-picker-split">
					<div className="template-picker-list">
						<CommandList className="template-picker-options">
							{groups.map((group) => (
								<CommandGroup key={group.id} heading={group.label}>
									{group.templates.map((template) => (
										<CommandItem
											key={`${group.id}:${template.id}`}
											value={template.id}
											onSelect={() => void handleCreate()}
										>
											<LayoutTemplateIcon />
											<span className="truncate">{template.name}</span>
										</CommandItem>
									))}
								</CommandGroup>
							))}
							<CommandGroup>
								<CommandItem value={BLANK_KEY} onSelect={() => void handleCreate()}>
									<FileIcon />
									<span className="truncate">{blankLabel}</span>
								</CommandItem>
							</CommandGroup>
						</CommandList>
						<PickerLinks activeTemplateId={activeTemplate?.id} />
					</div>
					<div className="template-picker-paper">
						<Input
							className="template-picker-title"
							value={title}
							placeholder="Untitled"
							aria-label="Note name"
							onChange={(event) =>
								setTitles((current) => ({ ...current, [activeKey]: event.target.value }))
							}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault()
									void handleCreate()
								}
							}}
						/>
						{activeTemplate && resolvedPreview ? (
							<TemplateNotePreview content={resolvedPreview.content} />
						) : null}
					</div>
				</div>
			</Command>
			<PickerFooter
				folder={folder}
				error={error ?? resolvedPreview?.error ?? null}
				creating={creating}
				onFolderChange={(value) => setFolders((current) => ({ ...current, [activeKey]: value }))}
				onCreate={() => void handleCreate()}
			/>
		</DialogContent>
	)
}
