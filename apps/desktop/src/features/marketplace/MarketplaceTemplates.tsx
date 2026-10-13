import {
	addPublicNoteTemplate,
	listMarketTemplates,
	type OpenedPublicTemplate,
	openPublicTemplate,
	type TemplateDefinition,
	useTemplateSharingStore,
	useTemplateStore,
	useUIStore,
	useVaultStore,
} from "@cortex/core"
import type { PublicTemplateInfo } from "@cortex/platform"
import type { DatabasePreset } from "@cortex/properties/database"
import {
	Button,
	Empty,
	EmptyDescription,
	EmptyMedia,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	ScrollArea,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	ToggleGroup,
	ToggleGroupItem,
	toast,
} from "@cortex/ui"
import { FileTextIcon, LayoutTemplateIcon, Search, ShieldCheckIcon, Table2Icon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { openNewDatabaseView } from "../databases/newDatabaseWorkspace"
import { TemplateNotePreview } from "../templates/TemplateNotePreview"
import { openTemplatesView } from "../templates/templateActions"
import { getTeamLabel, isTeamTemplate } from "../templates/templateGroups"
import { TEMPLATE_LINK_ENTRY_PREFIX } from "../templates/useTemplateDeepLink"
import type { MarketplaceViewTab } from "./marketplaceWorkspaceView"
import "../templates/templates.css"

type KindFilter = "all" | "note" | "database"
type EntryGroup = "link" | "team" | "vault" | "market"

interface TemplateEntry {
	id: string
	group: EntryGroup
	kind: "note" | "database"
	name: string
	author: string
	description: string
	version: number | null
	updatedAt: string | null
	template?: TemplateDefinition
	preset?: DatabasePreset
	slug?: string
}

interface MarketplaceTemplatesProps {
	selectedId: string | null
	onSelect: (id: string) => void
	onTabChange: (tab: MarketplaceViewTab) => void
}

const groupLabels: Record<EntryGroup, string> = {
	link: "From a link",
	team: "From your team",
	vault: "In this vault",
	market: "Marketplace",
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	year: "numeric",
})

function formatDate(value: string | null): string {
	if (!value) return "—"
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date)
}

function publicEntry(info: PublicTemplateInfo, group: "market" | "link"): TemplateEntry {
	return {
		id: `${group}:${info.slug}`,
		group,
		kind: info.kind,
		name: info.name,
		author: info.ownerName || "Someone",
		description: info.description,
		version: info.version,
		updatedAt: info.updatedAt,
		slug: info.slug,
	}
}

function useMarketEntries(kind: KindFilter, query: string) {
	const [state, setState] = useState<{
		entries: TemplateEntry[]
		loading: boolean
		error: string | null
	}>({ entries: [], loading: true, error: null })
	useEffect(() => {
		let cancelled = false
		setState((current) => ({ ...current, loading: true }))
		const timer = window.setTimeout(() => {
			listMarketTemplates({ kind: kind === "all" ? undefined : kind, text: query })
				.then((items) => {
					if (!cancelled) {
						setState({
							entries: items.map((item) => publicEntry(item, "market")),
							loading: false,
							error: null,
						})
					}
				})
				.catch((error: unknown) => {
					if (!cancelled) {
						setState({
							entries: [],
							loading: false,
							error: error instanceof Error ? error.message : String(error),
						})
					}
				})
		}, 200)
		return () => {
			cancelled = true
			window.clearTimeout(timer)
		}
	}, [kind, query])
	return state
}

function useOpenedTemplate(slug: string | undefined) {
	const [opened, setOpened] = useState<{
		slug: string
		value: OpenedPublicTemplate | null
		error: string | null
	} | null>(null)
	useEffect(() => {
		if (!slug) return
		let cancelled = false
		openPublicTemplate(slug)
			.then((value) => {
				if (!cancelled) setOpened({ slug, value, error: null })
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setOpened({
						slug,
						value: null,
						error: error instanceof Error ? error.message : String(error),
					})
				}
			})
		return () => {
			cancelled = true
		}
	}, [slug])
	return opened?.slug === slug ? opened : null
}

export function MarketplaceTemplates({
	selectedId,
	onSelect,
	onTabChange,
}: MarketplaceTemplatesProps) {
	const vault = useVaultStore((state) => state.vault)
	const templates = useTemplateStore((state) => state.templates)
	const teamPresets = useTemplateSharingStore((state) => state.teamDatabasePresets)
	const [kind, setKind] = useState<KindFilter>("all")
	const [query, setQuery] = useState("")
	const market = useMarketEntries(kind, query)
	const linkSlug = selectedId?.startsWith(TEMPLATE_LINK_ENTRY_PREFIX)
		? selectedId.slice(TEMPLATE_LINK_ENTRY_PREFIX.length)
		: undefined
	const linked = useOpenedTemplate(linkSlug)

	const entries = useMemo(() => {
		const text = query.trim().toLocaleLowerCase()
		const matches = (entry: TemplateEntry) =>
			(kind === "all" || entry.kind === kind) &&
			(!text || entry.name.toLocaleLowerCase().includes(text))
		const local: TemplateEntry[] = templates.map((template) => ({
			id: `${isTeamTemplate(template) ? "team" : "vault"}:${template.id}`,
			group: isTeamTemplate(template) ? "team" : "vault",
			kind: "note",
			name: template.name,
			author: isTeamTemplate(template) ? (template.remote?.sharedBy ?? "Your team") : "You",
			description: template.description ?? "",
			version: template.remote?.version ?? null,
			updatedAt: template.updatedAt,
			template,
		}))
		const teamDatabases: TemplateEntry[] = teamPresets.map((shared) => ({
			id: `teamdb:${shared.preset.id}`,
			group: "team",
			kind: "database",
			name: shared.preset.name,
			author: shared.ownerName || "Your team",
			description: shared.preset.hint,
			version: null,
			updatedAt: null,
			preset: shared.preset,
		}))
		const fromLink = linked?.value && linkSlug ? [publicEntry(linked.value.template, "link")] : []
		return [...fromLink, ...local, ...teamDatabases, ...market.entries].filter(
			(entry) => entry.group === "link" || matches(entry),
		)
	}, [kind, linkSlug, linked?.value, market.entries, query, teamPresets, templates])

	const selected =
		entries.find((entry) => entry.id === selectedId) ??
		(linkSlug ? entries.find((entry) => entry.slug === linkSlug) : undefined) ??
		entries[0] ??
		null
	const teamLabel = getTeamLabel(templates)
	const groups = (Object.keys(groupLabels) as EntryGroup[])
		.map((group) => ({
			group,
			label: group === "team" ? teamLabel : groupLabels[group],
			entries: entries.filter((entry) => entry.group === group),
		}))
		.filter((group) => group.entries.length > 0)

	return (
		<section className="marketplace-view" data-has-selection={Boolean(selected)}>
			<aside className="marketplace-catalog">
				<header className="marketplace-catalog-header">
					<h1>Marketplace</h1>
				</header>
				<InputGroup variant="search" className="marketplace-catalog-search">
					<InputGroupAddon>
						<Search />
					</InputGroupAddon>
					<InputGroupInput
						placeholder="Search templates..."
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</InputGroup>
				<Tabs value="templates" onValueChange={(value) => onTabChange(value as MarketplaceViewTab)}>
					<TabsList className="marketplace-catalog-tabs">
						<TabsTrigger value="plugins">Plugins</TabsTrigger>
						<TabsTrigger value="themes">Themes</TabsTrigger>
						<TabsTrigger value="templates">Templates</TabsTrigger>
					</TabsList>
				</Tabs>
				<ToggleGroup
					type="single"
					size="sm"
					className="marketplace-template-filter"
					value={kind}
					onValueChange={(value) => value && setKind(value as KindFilter)}
				>
					<ToggleGroupItem value="all">All</ToggleGroupItem>
					<ToggleGroupItem value="note">Notes</ToggleGroupItem>
					<ToggleGroupItem value="database">Databases</ToggleGroupItem>
				</ToggleGroup>
				{market.loading ? (
					<div className="marketplace-catalog-status">
						<Spinner className="size-3" />
						Loading templates...
					</div>
				) : null}
				<ScrollArea className="marketplace-catalog-scroll">
					{groups.length === 0 && !market.loading ? (
						<Empty className="min-h-[360px] border-none">
							<EmptyMedia variant="icon">
								<LayoutTemplateIcon />
							</EmptyMedia>
							<EmptyDescription>
								{market.error ?? (query ? "No templates match your search." : "No templates yet.")}
							</EmptyDescription>
						</Empty>
					) : (
						<div className="marketplace-catalog-list">
							{groups.map((group) => (
								<div key={group.group} className="marketplace-catalog-group">
									<div className="marketplace-catalog-group-header">
										<span>{group.label}</span>
										<b>{group.entries.length}</b>
									</div>
									{group.entries.map((entry) => (
										<div
											key={entry.id}
											className="marketplace-catalog-item"
											data-active={entry.id === selected?.id}
										>
											<Button
												variant="ghost"
												className="marketplace-catalog-row"
												aria-current={entry.id === selected?.id ? "true" : undefined}
												data-active={entry.id === selected?.id}
												onClick={() => onSelect(entry.id)}
											>
												<span className="marketplace-artwork" aria-hidden="true">
													{entry.kind === "database" ? (
														<Table2Icon size={16} />
													) : (
														<FileTextIcon size={16} />
													)}
												</span>
												<span className="marketplace-catalog-copy">
													<span className="marketplace-catalog-title">{entry.name}</span>
													<span className="marketplace-catalog-meta">
														{entry.author} · {entry.kind === "database" ? "Database" : "Note"}
													</span>
												</span>
											</Button>
										</div>
									))}
								</div>
							))}
						</div>
					)}
				</ScrollArea>
			</aside>
			{selected ? (
				<TemplateDetail key={selected.id} entry={selected} hasVault={Boolean(vault)} />
			) : (
				<div className="marketplace-detail-empty">
					<Empty className="border-none">
						<EmptyMedia variant="icon">
							<LayoutTemplateIcon />
						</EmptyMedia>
						<EmptyDescription>Pick a template to see what it adds.</EmptyDescription>
					</Empty>
				</div>
			)}
		</section>
	)
}

function TemplateDetail({ entry, hasVault }: { entry: TemplateEntry; hasVault: boolean }) {
	const vault = useVaultStore((state) => state.vault)
	const readTemplateBody = useTemplateStore((state) => state.readTemplateBody)
	const openCreateFromTemplate = useUIStore((state) => state.openCreateFromTemplate)
	const opened = useOpenedTemplate(entry.slug)
	const [localBody, setLocalBody] = useState<string | null>(null)
	const [added, setAdded] = useState<TemplateDefinition | null>(null)
	const [busy, setBusy] = useState(false)

	useEffect(() => {
		if (!vault || !entry.template) return
		let cancelled = false
		void readTemplateBody(vault, entry.template.id).then((body) => {
			if (!cancelled) setLocalBody(body)
		})
		return () => {
			cancelled = true
		}
	}, [entry.template, readTemplateBody, vault])

	const preset = entry.preset ?? opened?.value?.database ?? null
	const noteBody = entry.template ? localBody : (opened?.value?.note?.body ?? null)
	const isPublic = entry.group === "market" || entry.group === "link"
	const files =
		entry.kind === "database"
			? [
					`${entry.name}/`,
					`${entry.name}/${entry.name}.md`,
					...(preset?.samples ?? []).map((sample) => `${entry.name}/${sample.title}.md`),
				]
			: entry.group === "team"
				? []
				: [`.cortex/templates/${entry.name}.md`]

	const handleAdd = async () => {
		if (!vault || busy) return
		if (entry.kind === "database") {
			if (preset) openNewDatabaseView({ preset })
			return
		}
		if (!opened?.value) return
		setBusy(true)
		try {
			const definition = await addPublicNoteTemplate(
				vault,
				opened.value,
				entry.group === "link" ? "link" : "market",
			)
			setAdded(definition)
			toast(`Added “${definition.name}” to Templates`)
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error))
		} finally {
			setBusy(false)
		}
	}

	const primary = (() => {
		if (entry.group === "team" || entry.group === "vault") {
			return entry.kind === "database" ? (
				<Button size="sm" onClick={() => preset && openNewDatabaseView({ preset })}>
					Use template
				</Button>
			) : (
				<Button
					size="sm"
					onClick={() => entry.template && openCreateFromTemplate(entry.template.id)}
				>
					Use template
				</Button>
			)
		}
		if (added) {
			return (
				<>
					<span className="marketplace-template-added">In Templates</span>
					<Button variant="secondary" size="sm" onClick={() => openTemplatesView(added.id)}>
						Open
					</Button>
				</>
			)
		}
		return (
			<Button
				size="sm"
				disabled={!hasVault || busy || (!opened?.value && entry.kind === "note")}
				onClick={() => void handleAdd()}
			>
				{entry.kind === "database" ? "Create database" : "Add to vault"}
			</Button>
		)
	})()

	return (
		<section className="marketplace-detail">
			<ScrollArea className="h-full">
				<div className="marketplace-detail-page">
					<header className="marketplace-detail-hero">
						<span className="marketplace-artwork marketplace-detail-artwork" aria-hidden="true">
							{entry.kind === "database" ? <Table2Icon /> : <FileTextIcon />}
						</span>
						<div className="marketplace-detail-hero-copy">
							<h1>{entry.name}</h1>
							<span>
								{entry.author} · {entry.kind === "database" ? "Database template" : "Note template"}
							</span>
						</div>
						<div className="marketplace-detail-actions">{primary}</div>
					</header>
					{entry.description ? (
						<p className="marketplace-detail-lead">{entry.description}</p>
					) : null}
					{entry.group === "team" ? (
						<p className="marketplace-detail-lead">
							Shared with your team. It shows up in New from template and in /template — nothing to
							install.
						</p>
					) : null}
					<div className="marketplace-detail-body">
						<article className="marketplace-template-preview">
							<Tabs defaultValue="preview">
								<TabsList variant="line">
									<TabsTrigger value="preview">Preview</TabsTrigger>
									<TabsTrigger value="files">What’s added</TabsTrigger>
								</TabsList>
								<TabsContent value="preview" className="marketplace-template-preview-body">
									{isPublic && !opened ? <Spinner /> : null}
									{opened?.error ? <p className="template-picker-error">{opened.error}</p> : null}
									{entry.kind === "database" && preset ? (
										<DatabasePresetPreview preset={preset} />
									) : noteBody !== null ? (
										<TemplateNotePreview content={noteBody} title={entry.name} />
									) : null}
								</TabsContent>
								<TabsContent value="files" className="marketplace-template-preview-body">
									{files.length === 0 ? (
										<p className="marketplace-detail-lead">
											Nothing added — used straight from the team library.
										</p>
									) : (
										<ul className="marketplace-template-tree">
											{files.map((file) => (
												<li
													key={file}
													data-indent={file.split("/").filter(Boolean).length > 1 || undefined}
												>
													{file}
												</li>
											))}
										</ul>
									)}
								</TabsContent>
							</Tabs>
						</article>
						<aside className="marketplace-detail-aside">
							<div className="marketplace-template-facts">
								<b>Information</b>
								<dl>
									<dt>Version</dt>
									<dd>{entry.version ?? "—"}</dd>
									<dt>Updated</dt>
									<dd>{formatDate(entry.updatedAt)}</dd>
									<dt>Includes</dt>
									<dd>
										{entry.kind === "database"
											? `${preset?.views.length ?? 0} views · ${preset?.properties.length ?? 0} properties`
											: "1 note template"}
									</dd>
									<dt>Source</dt>
									<dd>{groupLabels[entry.group]}</dd>
								</dl>
							</div>
							<div className="marketplace-template-facts">
								<b>Safety</b>
								<p>
									<ShieldCheckIcon size={14} />
									Markdown only. Adds files to your vault. No code runs.
								</p>
							</div>
						</aside>
					</div>
				</div>
			</ScrollArea>
		</section>
	)
}

function DatabasePresetPreview({ preset }: { preset: DatabasePreset }) {
	const columns = preset.properties.slice(0, 5)
	return (
		<div className="db-new-table">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						{columns.map((column) => (
							<TableHead key={column.key}>{column.name}</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{preset.samples.length === 0 ? (
						<TableRow>
							<TableCell colSpan={columns.length + 1} className="db-new-muted">
								Empty — rows are notes you add.
							</TableCell>
						</TableRow>
					) : (
						preset.samples.map((sample) => (
							<TableRow key={sample.title}>
								<TableCell>{sample.title}</TableCell>
								{columns.map((column) => (
									<TableCell key={column.key}>{String(sample.values[column.key] ?? "—")}</TableCell>
								))}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</div>
	)
}
