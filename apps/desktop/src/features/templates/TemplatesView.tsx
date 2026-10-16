import { type TemplateDefinition, useTemplateStore, useVaultStore } from "@cortex/core"
import {
	getFileNameParts,
	getTemplateGroups,
	getTemplateValueLabel,
	isTeamTemplate,
} from "@cortex/core/templates"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
	ScrollArea,
	toast,
} from "@cortex/ui"
import {
	CopyIcon,
	EllipsisIcon,
	LayoutTemplateIcon,
	PlusIcon,
	SearchIcon,
	Share2Icon,
	Trash2Icon,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { CoreViewProps } from "../split-view/coreViewProps"
import { openShareTemplate } from "./shareActions"
import { TemplateNotePreview } from "./TemplateNotePreview"
import { openNewTemplate, openTemplateEditor } from "./templateActions"
import "./templates.css"
import { openCreateFromTemplate } from "@/utils/modals"

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })

function describeName(template: TemplateDefinition): string {
	const parts = getFileNameParts(template.fileNamePattern)
	if (!parts) return template.fileNamePattern
	if (parts.length === 0) return "Untitled"
	return parts.map(getTemplateValueLabel).join(" + ")
}

function describeUsage(template: TemplateDefinition): string {
	if (isTeamTemplate(template)) {
		const by = template.remote?.sharedBy
		const group = template.remote?.group
		if (by && group) return `Shared by ${by} with ${group}`
		if (by) return `Shared by ${by}`
		return "Shared with your team"
	}
	if (!template.lastUsedAt) return "Never used"
	const used = new Date(template.lastUsedAt)
	const today = new Date()
	if (used.toDateString() === today.toDateString()) return "Used last today"
	return `Used last on ${dateFormatter.format(used)}`
}

export function TemplatesView({ viewState, onStateChange }: CoreViewProps) {
	const vault = useVaultStore((state) => state.vault)
	const templates = useTemplateStore((state) => state.templates)
	const ensureTemplatesLoaded = useTemplateStore((state) => state.ensureTemplatesLoaded)
	const previewNoteFromTemplate = useTemplateStore((state) => state.previewNoteFromTemplate)
	const duplicateTemplate = useTemplateStore((state) => state.duplicateTemplate)
	const deleteTemplate = useTemplateStore((state) => state.deleteTemplate)
	const readTemplateBody = useTemplateStore((state) => state.readTemplateBody)
	const restoreTemplate = useTemplateStore((state) => state.restoreTemplate)
	const [query, setQuery] = useState("")
	const [preview, setPreview] = useState<{ id: string; content: string; title: string } | null>(
		null,
	)
	const requestedId = typeof viewState.templateId === "string" ? viewState.templateId : null

	useEffect(() => {
		if (vault) void ensureTemplatesLoaded(vault)
	}, [ensureTemplatesLoaded, vault])

	const groups = useMemo(
		() => getTemplateGroups(templates, { includeRecent: false, showTeam: true, query }),
		[query, templates],
	)
	const visible = groups.flatMap((group) => group.templates)
	const selected = visible.find((template) => template.id === requestedId) ?? visible[0] ?? null
	const select = (templateId: string) => onStateChange({ ...viewState, templateId })

	useEffect(() => {
		if (!vault || !selected) return
		let cancelled = false
		previewNoteFromTemplate(vault, { templateId: selected.id })
			.then((result) => {
				if (cancelled) return
				const title = result.fileName.replace(/\.md$/i, "")
				setPreview({ id: selected.id, content: result.content, title })
			})
			.catch(() => {
				if (!cancelled) setPreview({ id: selected.id, content: "", title: selected.name })
			})
		return () => {
			cancelled = true
		}
	}, [previewNoteFromTemplate, selected, vault])

	const handleDuplicate = async (template: TemplateDefinition) => {
		if (!vault) return
		const copy = await duplicateTemplate(vault, template.id)
		select(copy.id)
		toast(`Copied “${template.name}”`)
	}

	const handleEditCopy = async (template: TemplateDefinition) => {
		if (!vault) return
		const copy = await duplicateTemplate(vault, template.id)
		openTemplateEditor(copy.id, copy.name)
	}

	const handleDelete = async (template: TemplateDefinition) => {
		if (!vault) return
		const body = await readTemplateBody(vault, template.id)
		await deleteTemplate(vault, template.id)
		toast(`Deleted “${template.name}”`, {
			action: {
				label: "Undo",
				onClick: () => void restoreTemplate(vault, template, body),
			},
		})
	}

	const selectedPreview = selected && preview?.id === selected.id ? preview : null
	const mine = selected ? !isTeamTemplate(selected) : false

	return (
		<section className="templates-view">
			<aside className="templates-list">
				<header className="templates-list-header">
					<h1>Templates</h1>
					<Button size="xs" onClick={() => openNewTemplate({ start: "blank" })}>
						<PlusIcon />
						New
					</Button>
				</header>
				<InputGroup variant="search" size="sm" className="templates-list-search">
					<InputGroupAddon>
						<SearchIcon />
					</InputGroupAddon>
					<InputGroupInput
						value={query}
						placeholder="Find a template"
						aria-label="Find a template"
						onChange={(event) => setQuery(event.target.value)}
					/>
				</InputGroup>
				<ScrollArea className="templates-list-scroll">
					{groups.map((group) => (
						<div key={group.id} className="templates-list-group">
							<div className="templates-list-label">{group.label}</div>
							{group.templates.map((template) => (
								<Item key={template.id} asChild size="sm" className="templates-list-row">
									<button
										type="button"
										aria-pressed={template.id === selected?.id}
										onClick={() => select(template.id)}
									>
										<ItemMedia variant="icon">
											<LayoutTemplateIcon />
										</ItemMedia>
										<ItemContent>
											<ItemTitle>{template.name}</ItemTitle>
											{template.description ? (
												<ItemDescription>{template.description}</ItemDescription>
											) : null}
										</ItemContent>
									</button>
								</Item>
							))}
						</div>
					))}
				</ScrollArea>
			</aside>
			<div className="templates-detail">
				{selected ? (
					<div className="templates-detail-column">
						<div className="templates-detail-head">
							<div className="templates-detail-copy">
								<h2>{selected.name}</h2>
								{selected.description ? <p>{selected.description}</p> : null}
							</div>
							<div className="templates-detail-actions">
								<Button onClick={() => openCreateFromTemplate(selected.id)}>Use</Button>
								{mine ? (
									<Button
										variant="secondary"
										onClick={() => openTemplateEditor(selected.id, selected.name)}
									>
										Edit
									</Button>
								) : (
									<Button variant="secondary" onClick={() => void handleEditCopy(selected)}>
										Make a copy to edit
									</Button>
								)}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon" aria-label="More actions">
											<EllipsisIcon />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-48">
										{mine ? (
											<DropdownMenuItem onSelect={() => openShareTemplate(selected.id)}>
												<Share2Icon />
												Share…
											</DropdownMenuItem>
										) : null}
										<DropdownMenuItem onSelect={() => void handleDuplicate(selected)}>
											<CopyIcon />
											Duplicate
										</DropdownMenuItem>
										{mine ? (
											<>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													variant="destructive"
													onSelect={() => void handleDelete(selected)}
												>
													<Trash2Icon />
													Delete
												</DropdownMenuItem>
											</>
										) : null}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>
						<div className="templates-detail-meta">
							<span>
								New notes go to <b>{selected.targetFolderPattern || "Vault root"}</b>
							</span>
							<span>
								Named <b>{describeName(selected)}</b>
							</span>
							<span>{describeUsage(selected)}</span>
						</div>
						<div className="templates-detail-preview">
							<div className="templates-detail-preview-label">A new note will look like this</div>
							{selectedPreview ? (
								<TemplateNotePreview
									content={selectedPreview.content}
									title={selectedPreview.title}
								/>
							) : null}
						</div>
					</div>
				) : (
					<Empty className="templates-detail-empty border-none">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<LayoutTemplateIcon />
							</EmptyMedia>
							<EmptyTitle>{query ? "No matching templates" : "No templates yet"}</EmptyTitle>
							<EmptyDescription>
								Templates are starting points for new notes. Save a note as a template or start from
								a blank page.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</section>
	)
}
