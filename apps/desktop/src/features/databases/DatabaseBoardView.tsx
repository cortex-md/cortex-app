import { updateDatabaseCell } from "@cortex/core"
import {
	allowsMultipleValues,
	getPropertyValueList,
	type PropertyDefinition,
	type ResolvedAuthorConfig,
} from "@cortex/properties"
import {
	DATABASE_NO_VALUE_GROUP,
	type DatabaseGroup,
	type DatabaseRow,
	getPropertyBaseType,
	groupDatabaseRows,
	type ResolvedDatabaseProperties,
} from "@cortex/properties/database"
import { Button, Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@cortex/ui"
import { PlusIcon } from "lucide-react"
import { type DragEvent, useMemo, useRef, useState } from "react"
import { acceptsRowDrag, DatabaseCard, readDraggedRowPath } from "./DatabaseCard"
import { DatabaseOptionLabel } from "./DatabaseOptionLabel"

interface DatabaseBoardViewProps {
	folderPath: string
	rows: DatabaseRow[]
	groupKey: string | undefined
	resolved: ResolvedDatabaseProperties
	columns: PropertyDefinition[]
	selectedPath: string | null
	authorConfig: ResolvedAuthorConfig
	today: string
	readOnly: boolean
	onSelect: (path: string) => void
	onCreate: (group: DatabaseGroup) => void
}

export function getBoardGroupKey(
	groupKey: string | undefined,
	resolved: ResolvedDatabaseProperties,
): string | undefined {
	if (groupKey && resolved.byKey.has(groupKey)) return groupKey
	return resolved.properties.find((definition) => getPropertyBaseType(definition) === "select")?.key
}

function sameGroupValue(left: unknown, right: unknown): boolean {
	return String(left).trim().toLocaleLowerCase() === String(right).trim().toLocaleLowerCase()
}

function getMovedValue(
	row: DatabaseRow,
	definition: PropertyDefinition | undefined,
	from: DatabaseGroup | undefined,
	to: DatabaseGroup,
): unknown {
	const target = to.key === DATABASE_NO_VALUE_GROUP ? undefined : to.value
	const multiple =
		definition !== undefined &&
		(allowsMultipleValues(definition) || getPropertyBaseType(definition) === "tags")
	if (!multiple) return target
	const kept = getPropertyValueList(row.meta[definition.key]).filter(
		(value) =>
			(from === undefined || from.key === DATABASE_NO_VALUE_GROUP
				? true
				: !sameGroupValue(value, from.value)) &&
			(target === undefined || !sameGroupValue(value, target)),
	)
	const next = target === undefined ? kept : [...kept, target]
	return next.length > 0 ? next : undefined
}

export function DatabaseBoardView({
	folderPath,
	rows,
	groupKey,
	resolved,
	columns,
	selectedPath,
	authorConfig,
	today,
	readOnly,
	onSelect,
	onCreate,
}: DatabaseBoardViewProps) {
	const [dropTarget, setDropTarget] = useState<string | null>(null)
	const dragSourceRef = useRef<DatabaseGroup | undefined>(undefined)
	const key = getBoardGroupKey(groupKey, resolved)
	const groups = useMemo(
		() =>
			key
				? groupDatabaseRows(rows, key, resolved).filter(
						(group) => group.key !== DATABASE_NO_VALUE_GROUP || group.rows.length > 0,
					)
				: [],
		[key, resolved, rows],
	)
	const cardProperties = useMemo(
		() => columns.filter((definition) => definition.key !== key).slice(0, 3),
		[columns, key],
	)

	if (!key) {
		return (
			<Empty className="db-empty">
				<EmptyHeader>
					<EmptyTitle>Board needs a select property</EmptyTitle>
					<EmptyDescription>
						Add a Select property such as Status to a note, then group the board by it.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	const handleDrop = (event: DragEvent, group: DatabaseGroup) => {
		event.preventDefault()
		setDropTarget(null)
		const path = readDraggedRowPath(event)
		const from = dragSourceRef.current
		dragSourceRef.current = undefined
		const row = rows.find((candidate) => candidate.path === path)
		if (!row || from?.key === group.key) return
		const value = getMovedValue(row, resolved.byKey.get(key), from, group)
		void updateDatabaseCell(folderPath, row.path, key, value)
	}

	return (
		<div
			className="db-board"
			style={{ gridTemplateColumns: `repeat(${Math.max(groups.length, 1)}, minmax(240px, 1fr))` }}
		>
			{groups.map((group) => (
				<section
					key={group.key}
					className="db-board-column"
					aria-label={group.label}
					data-drop-target={dropTarget === group.key || undefined}
					onDragOver={(event) => {
						if (readOnly || !acceptsRowDrag(event)) return
						event.preventDefault()
						event.dataTransfer.dropEffect = "move"
						if (dropTarget !== group.key) setDropTarget(group.key)
					}}
					onDragStart={() => {
						dragSourceRef.current = group
					}}
					onDragLeave={() => setDropTarget((current) => (current === group.key ? null : current))}
					onDrop={(event) => handleDrop(event, group)}
				>
					<header className="db-board-head">
						<DatabaseOptionLabel group={group} />
						<small>{group.rows.length}</small>
					</header>
					<div className="db-board-cards">
						{group.rows.map((row) => (
							<DatabaseCard
								key={row.path}
								row={row}
								properties={cardProperties}
								authorConfig={authorConfig}
								today={today}
								selected={row.path === selectedPath}
								draggable={!readOnly}
								onSelect={onSelect}
							/>
						))}
					</div>
					{!readOnly && (
						<Button
							size="sm"
							variant="ghost"
							className="db-col-add"
							onClick={() => onCreate(group)}
						>
							<PlusIcon />
							New
						</Button>
					)}
				</section>
			))}
		</div>
	)
}
