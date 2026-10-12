import {
	buildTagTree,
	selectActiveTab,
	selectSortedTags,
	type TagTreeNode,
	useTagsStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { Button } from "@cortex/ui"
import { ChevronRightIcon, TagIcon } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { formatCount, toggleSetItem } from "@/utils/format"
import { SidebarNoVaultState, SidebarToolView } from "../sidebar/SidebarToolView"
import { openTagView, TAG_VIEW_ID } from "./tagWorkspaceView"

interface TagTreeRowProps {
	node: TagTreeNode
	depth: number
	expandedTags: ReadonlySet<string>
	forceExpanded: boolean
	activeTag: string | null
	onToggle: (tag: string) => void
}

function TagTreeRow({
	node,
	depth,
	expandedTags,
	forceExpanded,
	activeTag,
	onToggle,
}: TagTreeRowProps) {
	const hasChildren = node.children.length > 0
	const isExpanded = hasChildren && (forceExpanded || expandedTags.has(node.tag))
	return (
		<>
			<div
				className="sidebar-tag-row"
				data-active={node.tag === activeTag || undefined}
				style={{ paddingLeft: 6 + depth * 16 }}
			>
				{hasChildren ? (
					<Button
						variant="ghost"
						size="icon-xs"
						className="sidebar-tag-toggle"
						aria-label={isExpanded ? `Collapse ${node.tag}` : `Expand ${node.tag}`}
						onClick={() => onToggle(node.tag)}
					>
						<ChevronRightIcon
							className="sidebar-tag-chevron"
							data-expanded={isExpanded ? "true" : "false"}
						/>
					</Button>
				) : (
					<span className="sidebar-tag-toggle" aria-hidden="true" />
				)}
				<Button
					variant="ghost"
					className="sidebar-tag-open"
					aria-label={`Open #${node.tag}`}
					aria-current={node.tag === activeTag ? "page" : undefined}
					onClick={() => openTagView(node.tag)}
				>
					<span
						className="sidebar-tag-swatch"
						style={{ backgroundColor: node.color ?? "var(--text-muted)" }}
					/>
					<span className="sidebar-tag-name">{node.name}</span>
					<span className="sidebar-tag-count">{node.count}</span>
				</Button>
			</div>
			{isExpanded &&
				node.children.map((child) => (
					<TagTreeRow
						key={child.tag}
						node={child}
						depth={depth + 1}
						expandedTags={expandedTags}
						forceExpanded={forceExpanded}
						activeTag={activeTag}
						onToggle={onToggle}
					/>
				))}
		</>
	)
}

export function TagsSidebar() {
	const vault = useVaultStore((s) => s.vault)
	const tagIndex = useTagsStore((s) => s.tagIndex)
	const tagColors = useTagsStore((s) => s.tagColors)
	const activeTag = useWorkspaceStore((s) => {
		const tab = selectActiveTab(s)
		return tab?.viewId === TAG_VIEW_ID && typeof tab.viewState?.tag === "string"
			? tab.viewState.tag
			: null
	})
	const [filterQuery, setFilterQuery] = useState("")
	const [expandedTags, setExpandedTags] = useState<ReadonlySet<string>>(() => new Set())

	const allTags = useMemo(() => selectSortedTags({ tagIndex, tagColors }), [tagColors, tagIndex])
	const tree = useMemo(() => {
		const query = filterQuery.trim().toLowerCase()
		const entries = query
			? allTags.filter((entry) => entry.tag.toLowerCase().includes(query))
			: allTags
		return buildTagTree(entries)
	}, [allTags, filterQuery])

	const handleToggle = useCallback((tag: string) => {
		setExpandedTags((previous) => toggleSetItem(previous, tag))
	}, [])

	if (!vault) return <SidebarNoVaultState />

	return (
		<SidebarToolView
			title="Tags"
			filterLabel="Filter tags"
			filterIcon={<TagIcon />}
			filterPlaceholder="Filter tags..."
			filterValue={filterQuery}
			onFilterChange={setFilterQuery}
			count={allTags.length === 0 ? "No tags found" : formatCount(allTags.length, "tag")}
			empty={
				tree.length === 0
					? {
							icon: <TagIcon className="size-6 text-muted-foreground" />,
							message: filterQuery ? "No tags match your filter" : "No tags in vault",
							clearable: Boolean(filterQuery),
						}
					: null
			}
		>
			<div className="sidebar-tool-list">
				{tree.map((node) => (
					<TagTreeRow
						key={node.tag}
						node={node}
						depth={0}
						expandedTags={expandedTags}
						forceExpanded={Boolean(filterQuery.trim())}
						activeTag={activeTag}
						onToggle={handleToggle}
					/>
				))}
			</div>
		</SidebarToolView>
	)
}
