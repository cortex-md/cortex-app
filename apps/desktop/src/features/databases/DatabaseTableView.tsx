import type { PropertyDefinition, ResolvedAuthorConfig } from "@cortex/properties"
import {
	DATABASE_TITLE_KEY,
	type DatabaseGroup,
	type DatabaseRow,
	type DatabaseSort,
} from "@cortex/properties/database"
import { Button } from "@cortex/ui"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, FileTextIcon, PlusIcon } from "lucide-react"
import { type CSSProperties, memo, useMemo, useRef, useState } from "react"
import { acceptsRowDrag, readDraggedRowPath, startRowDrag } from "./DatabaseCard"
import { DatabaseCell } from "./DatabaseCell"
import { DatabaseOptionLabel } from "./DatabaseOptionLabel"
import { DatabaseTitleInput } from "./DatabaseTitleInput"

type TableItem =
	| { kind: "group"; key: string; group: DatabaseGroup; collapsed: boolean; first: boolean }
	| { kind: "row"; key: string; row: DatabaseRow; first: boolean }
	| { kind: "new"; key: string; group: DatabaseGroup | null }

interface DatabaseTableViewProps {
	folderPath: string
	groups: DatabaseGroup[]
	grouped: boolean
	columns: PropertyDefinition[]
	collapsed: ReadonlySet<string>
	selectedPath: string | null
	authorConfig: ResolvedAuthorConfig
	today: string
	sort: DatabaseSort | undefined
	readOnly: boolean
	onToggleGroup: (key: string) => void
	onSelect: (path: string) => void
	onCreate: (group: DatabaseGroup | null) => void
	onSort: (key: string) => void
	onUpdateDefinition: (definition: PropertyDefinition) => Promise<void>
	onReorder?: (draggedPath: string, targetPath: string) => void
	onRename?: (path: string, name: string) => Promise<unknown>
}

const ROW_HEIGHT = 48
const GROUP_HEIGHT = 54
const FIRST_GROUP_HEIGHT = 40
const NEW_HEIGHT = 40

function buildItems(
	groups: readonly DatabaseGroup[],
	grouped: boolean,
	collapsed: ReadonlySet<string>,
	readOnly: boolean,
): TableItem[] {
	const items: TableItem[] = []
	if (!grouped) {
		for (const [index, row] of (groups[0]?.rows ?? []).entries()) {
			items.push({ kind: "row", key: row.path, row, first: index === 0 })
		}
		if (!readOnly) items.push({ kind: "new", key: "new", group: null })
		return items
	}
	for (const group of groups) {
		if (group.rows.length === 0) continue
		const isCollapsed = collapsed.has(group.key)
		items.push({
			kind: "group",
			key: `group:${group.key}`,
			group,
			collapsed: isCollapsed,
			first: items.length === 0,
		})
		if (isCollapsed) continue
		for (const [index, row] of group.rows.entries()) {
			items.push({ kind: "row", key: `${group.key}:${row.path}`, row, first: index === 0 })
		}
		if (!readOnly) items.push({ kind: "new", key: `new:${group.key}`, group })
	}
	if (items.length === 0 && !readOnly) items.push({ kind: "new", key: "new", group: null })
	return items
}

function itemHeight(item: TableItem | undefined): number {
	if (!item) return ROW_HEIGHT
	if (item.kind === "group") return item.first ? FIRST_GROUP_HEIGHT : GROUP_HEIGHT
	return item.kind === "new" ? NEW_HEIGHT : ROW_HEIGHT
}

interface TableRowProps {
	folderPath: string
	row: DatabaseRow
	first: boolean
	columns: PropertyDefinition[]
	selected: boolean
	authorConfig: ResolvedAuthorConfig
	today: string
	onSelect: (path: string) => void
	onUpdateDefinition: (definition: PropertyDefinition) => Promise<void>
	onReorder?: (draggedPath: string, targetPath: string) => void
	onRename?: (path: string, name: string) => Promise<unknown>
}

const TableRow = memo(function TableRow({
	folderPath,
	row,
	first,
	columns,
	selected,
	authorConfig,
	today,
	onSelect,
	onUpdateDefinition,
	onReorder,
	onRename,
}: TableRowProps) {
	const [dropping, setDropping] = useState(false)
	const [editing, setEditing] = useState(false)
	return (
		<div
			className="db-row"
			data-first={first || undefined}
			data-selected={selected || undefined}
			data-drop-target={dropping || undefined}
		>
			<div className="db-tr">
				{editing && onRename ? (
					<span className="db-title-cell db-title-editing">
						<FileTextIcon className="db-title-icon" />
						<DatabaseTitleInput
							value={row.title}
							label="Note title"
							className="db-row-title-input"
							readOnly={false}
							autoFocus
							onRename={(name) => onRename(row.path, name)}
							onDone={() => setEditing(false)}
						/>
					</span>
				) : (
					<Button
						variant="ghost"
						className="db-title-cell"
						draggable={Boolean(onReorder)}
						onDragStart={onReorder ? (event) => startRowDrag(event, row.path) : undefined}
						onDragOver={(event) => {
							if (!onReorder || !acceptsRowDrag(event)) return
							event.preventDefault()
							if (!dropping) setDropping(true)
						}}
						onDragLeave={() => setDropping(false)}
						onDrop={(event) => {
							setDropping(false)
							const dragged = readDraggedRowPath(event)
							if (!onReorder || !dragged || dragged === row.path) return
							event.preventDefault()
							onReorder(dragged, row.path)
						}}
						onClick={() => onSelect(row.path)}
						onDoubleClick={onRename ? () => setEditing(true) : undefined}
						onKeyDown={(event) => {
							if (event.key === "F2" && onRename) {
								event.preventDefault()
								setEditing(true)
							}
						}}
					>
						<FileTextIcon className="db-title-icon" />
						<span className="db-title-text">{row.title}</span>
						<span className="db-open-hint">Open</span>
					</Button>
				)}
				{columns.map((definition) => (
					<DatabaseCell
						key={definition.id}
						folderPath={folderPath}
						row={row}
						definition={definition}
						authorConfig={authorConfig}
						today={today}
						onUpdateDefinition={onUpdateDefinition}
					/>
				))}
			</div>
		</div>
	)
})

function SortIndicator({ sort, columnKey }: { sort: DatabaseSort | undefined; columnKey: string }) {
	if (sort?.key !== columnKey) return null
	return sort.dir === "desc" ? <ArrowDownIcon /> : <ArrowUpIcon />
}

export function DatabaseTableView({
	folderPath,
	groups,
	grouped,
	columns,
	collapsed,
	selectedPath,
	authorConfig,
	today,
	sort,
	readOnly,
	onToggleGroup,
	onSelect,
	onCreate,
	onSort,
	onUpdateDefinition,
	onReorder,
	onRename,
}: DatabaseTableViewProps) {
	const scrollRef = useRef<HTMLDivElement>(null)
	const items = useMemo(
		() => buildItems(groups, grouped, collapsed, readOnly),
		[groups, grouped, collapsed, readOnly],
	)
	const style = useMemo(
		() =>
			({
				"--db-grid": `minmax(240px, 2fr) ${columns.map(() => "minmax(132px, 1fr)").join(" ")}`,
			}) as CSSProperties,
		[columns],
	)
	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: (index) => itemHeight(items[index]),
		getItemKey: (index) => items[index]?.key ?? index,
		overscan: 12,
	})

	return (
		<div ref={scrollRef} className="db-table-scroll">
			<div className="db-table" style={style}>
				<div className="db-tr db-th">
					<Button variant="ghost" className="db-th-cell" onClick={() => onSort(DATABASE_TITLE_KEY)}>
						Name
						<SortIndicator sort={sort} columnKey={DATABASE_TITLE_KEY} />
					</Button>
					{columns.map((definition) => (
						<Button
							key={definition.id}
							variant="ghost"
							className="db-th-cell"
							data-sorted={sort?.key === definition.key || undefined}
							onClick={() => onSort(definition.key)}
						>
							{definition.name}
							<SortIndicator sort={sort} columnKey={definition.key} />
						</Button>
					))}
				</div>
				<div className="db-tbody" style={{ height: virtualizer.getTotalSize() }}>
					{virtualizer.getVirtualItems().map((virtualRow) => {
						const item = items[virtualRow.index]
						if (!item) return null
						return (
							<div
								key={virtualRow.key}
								className="db-virtual-row"
								style={{ transform: `translateY(${virtualRow.start}px)` }}
							>
								{item.kind === "group" ? (
									<Button
										variant="ghost"
										className="db-group-head"
										data-first={item.first || undefined}
										aria-expanded={!item.collapsed}
										onClick={() => onToggleGroup(item.group.key)}
									>
										<ChevronDownIcon className="db-group-chevron" />
										<DatabaseOptionLabel group={item.group} />
										<small>{item.group.rows.length}</small>
									</Button>
								) : item.kind === "row" ? (
									<TableRow
										folderPath={folderPath}
										row={item.row}
										first={item.first}
										columns={columns}
										selected={item.row.path === selectedPath}
										authorConfig={authorConfig}
										today={today}
										onSelect={onSelect}
										onUpdateDefinition={onUpdateDefinition}
										onReorder={onReorder}
										onRename={onRename}
									/>
								) : (
									<Button
										variant="ghost"
										className="db-new-row"
										onClick={() => onCreate(item.group)}
									>
										<PlusIcon />
										New
									</Button>
								)}
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}
