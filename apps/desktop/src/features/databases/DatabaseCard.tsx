import {
	isEmptyPropertyValue,
	type PropertyDefinition,
	type ResolvedAuthorConfig,
} from "@cortex/properties"
import type { DatabaseRow } from "@cortex/properties/database"
import { Button } from "@cortex/ui"
import { type DragEvent, memo } from "react"
import { DatabaseValue } from "./DatabaseValue"

export const DATABASE_ROW_DRAG_TYPE = "application/x-cortex-database-row"

export function startRowDrag(event: DragEvent<HTMLElement>, path: string) {
	event.dataTransfer.setData(DATABASE_ROW_DRAG_TYPE, path)
	event.dataTransfer.effectAllowed = "move"
}

export function readDraggedRowPath(event: DragEvent): string | null {
	const path = event.dataTransfer.getData(DATABASE_ROW_DRAG_TYPE)
	return path || null
}

export function acceptsRowDrag(event: DragEvent): boolean {
	return event.dataTransfer.types.includes(DATABASE_ROW_DRAG_TYPE)
}

export function getRowTone(path: string): number {
	let hash = 0
	for (let index = 0; index < path.length; index++) hash = (hash * 33 + path.charCodeAt(index)) | 0
	return (Math.abs(hash) % 4) + 1
}

interface DatabaseCardProps {
	row: DatabaseRow
	properties: PropertyDefinition[]
	authorConfig: ResolvedAuthorConfig
	today: string
	selected: boolean
	variant?: "card" | "gallery"
	coverUrl?: string | null
	draggable?: boolean
	onSelect: (path: string) => void
}

function CardMeta({
	row,
	properties,
	authorConfig,
	today,
}: Pick<DatabaseCardProps, "row" | "properties" | "authorConfig" | "today">) {
	const filled = properties.filter((definition) => !isEmptyPropertyValue(row.meta[definition.key]))
	if (filled.length === 0) return null
	return (
		<span className="db-card-meta">
			{filled.map((definition) => (
				<DatabaseValue
					key={definition.id}
					definition={definition}
					value={row.meta[definition.key]}
					authorConfig={authorConfig}
					today={today}
					compact
					avatarOnly
				/>
			))}
		</span>
	)
}

export const DatabaseCard = memo(function DatabaseCard({
	row,
	properties,
	authorConfig,
	today,
	selected,
	variant = "card",
	coverUrl = null,
	draggable = false,
	onSelect,
}: DatabaseCardProps) {
	const dragProps = draggable
		? {
				draggable: true,
				onDragStart: (event: DragEvent<HTMLButtonElement>) => startRowDrag(event, row.path),
			}
		: {}
	if (variant === "gallery") {
		return (
			<Button
				variant="ghost"
				className="db-gcard"
				data-selected={selected || undefined}
				{...dragProps}
				onClick={() => onSelect(row.path)}
			>
				<span className="db-cover" data-tone={getRowTone(row.path)} aria-hidden="true">
					{coverUrl ? (
						<img src={coverUrl} alt="" loading="lazy" />
					) : (
						<span className="db-md-mini">{row.preview}</span>
					)}
				</span>
				<span className="db-gcard-body">
					<b>{row.title}</b>
					{row.excerpt && <span className="db-gcard-excerpt">{row.excerpt}</span>}
					<CardMeta row={row} properties={properties} authorConfig={authorConfig} today={today} />
				</span>
			</Button>
		)
	}
	return (
		<Button
			variant="ghost"
			className="db-card"
			data-selected={selected || undefined}
			{...dragProps}
			onClick={() => onSelect(row.path)}
		>
			<b>{row.title}</b>
			<CardMeta row={row} properties={properties} authorConfig={authorConfig} today={today} />
		</Button>
	)
})
