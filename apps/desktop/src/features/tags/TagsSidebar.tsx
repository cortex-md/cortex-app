import {
	getNotePathPresentation,
	useTagsStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { Badge, Button, InputGroup, InputGroupAddon, InputGroupInput } from "@cortex/ui"
import { ChevronRightIcon, FileIcon, FolderIcon, TagIcon } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

interface SidebarNotePresentation {
	title: string
	folder: string
}

function getSidebarNotePresentation(filePath: string, vaultPath: string): SidebarNotePresentation {
	const notePath = getNotePathPresentation(filePath, vaultPath)
	const folder = notePath.segments
		.slice(0, -1)
		.map((segment) => segment.label)
		.join("/")
	return {
		title: notePath.title,
		folder,
	}
}

function TagRow({
	tag,
	color,
	filePaths,
	vaultPath,
	isExpanded,
	onToggle,
	onOpenFile,
}: {
	tag: string
	color: string | null
	filePaths: string[]
	vaultPath: string
	isExpanded: boolean
	onToggle: (tag: string) => void
	onOpenFile: (filePath: string) => void
}) {
	return (
		<div className="sidebar-tag-group" data-expanded={isExpanded ? "true" : "false"}>
			<button
				type="button"
				className="sidebar-tag-row"
				onClick={() => onToggle(tag)}
				aria-expanded={isExpanded}
			>
				<ChevronRightIcon
					className="sidebar-tag-chevron"
					data-expanded={isExpanded ? "true" : "false"}
				/>
				<span
					className="sidebar-tag-swatch"
					style={{ backgroundColor: color ? color : "var(--accent)" }}
				/>
				<span className="sidebar-tag-copy">
					<span className="sidebar-tag-name">{tag}</span>
				</span>
				<Badge variant="secondary" className="sidebar-tag-count">
					{filePaths.length}
				</Badge>
			</button>

			{isExpanded && (
				<div className="sidebar-tag-files">
					{filePaths.map((filePath) => {
						const notePath = getSidebarNotePresentation(filePath, vaultPath)

						return (
							<button
								type="button"
								key={filePath}
								className="sidebar-tag-file"
								onClick={() => onOpenFile(filePath)}
								aria-label={`Open ${notePath.title}`}
							>
								<FileIcon className="sidebar-tag-file-icon" />
								<span className="sidebar-tag-file-copy">
									<span className="sidebar-tag-file-title">{notePath.title}</span>
									{notePath.folder && (
										<span className="sidebar-tag-file-path">
											<FolderIcon className="sidebar-tag-file-folder-icon" />
											<span>{notePath.folder}</span>
										</span>
									)}
								</span>
							</button>
						)
					})}
				</div>
			)}
		</div>
	)
}

export function TagsSidebar() {
	const vault = useVaultStore((s) => s.vault)
	const openTab = useWorkspaceStore((s) => s.openTab)
	const tagIndex = useTagsStore((s) => s.tagIndex)
	const tagColors = useTagsStore((s) => s.tagColors)
	const [filterQuery, setFilterQuery] = useState("")
	const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())

	const allTags = useMemo(
		() =>
			Object.entries(tagIndex)
				.map(([tag, filePaths]) => ({
					tag,
					color: tagColors[tag] ?? null,
					filePaths,
				}))
				.sort((a, b) => b.filePaths.length - a.filePaths.length || a.tag.localeCompare(b.tag)),
		[tagColors, tagIndex],
	)

	const filteredTags = useMemo(() => {
		if (!filterQuery.trim()) return allTags
		const query = filterQuery.toLowerCase()
		return allTags.filter((entry) => entry.tag.toLowerCase().includes(query))
	}, [allTags, filterQuery])

	const handleToggleExpand = useCallback((tag: string) => {
		setExpandedTags((prev) => {
			const next = new Set(prev)
			if (next.has(tag)) {
				next.delete(tag)
			} else {
				next.add(tag)
			}
			return next
		})
	}, [])

	const handleOpenFile = useCallback(
		(filePath: string) => {
			openTab(filePath)
		},
		[openTab],
	)

	if (!vault) {
		return (
			<div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
				No vault open
			</div>
		)
	}

	return (
		<div className="sidebar-tags-view">
			<div className="sidebar-tool-header">
				<InputGroup variant="search" aria-label="Filter tags">
					<InputGroupAddon>
						<TagIcon />
					</InputGroupAddon>
					<InputGroupInput
						type="text"
						value={filterQuery}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterQuery(e.target.value)}
						placeholder="Filter tags..."
					/>
				</InputGroup>
				<div className="sidebar-tool-meta-row">
					<span className="sidebar-tool-count">
						{allTags.length === 0
							? "No tags found"
							: `${allTags.length} tag${allTags.length !== 1 ? "s" : ""}`}
					</span>
				</div>
			</div>

			<div className="sidebar-tool-scroll">
				{filteredTags.length === 0 ? (
					<div className="sidebar-tool-empty sidebar-tool-empty-stacked">
						<TagIcon className="size-6 text-muted-foreground/50" />
						<p className="text-xs text-muted-foreground">
							{filterQuery ? "No tags match your filter" : "No tags in vault"}
						</p>
						{filterQuery && (
							<Button
								variant="ghost"
								size="sm"
								className="text-xs h-7"
								onClick={() => setFilterQuery("")}
							>
								Clear filter
							</Button>
						)}
					</div>
				) : (
					<div className="sidebar-tags-list">
						{filteredTags.map((entry) => (
							<TagRow
								key={entry.tag}
								tag={entry.tag}
								color={entry.color}
								filePaths={entry.filePaths}
								vaultPath={vault.path}
								isExpanded={expandedTags.has(entry.tag)}
								onToggle={handleToggleExpand}
								onOpenFile={handleOpenFile}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
