import {
	getPropertyValueList,
	type PropertyDefinition,
	type ResolvedAuthorConfig,
} from "@cortex/properties"
import type { DatabaseRow } from "@cortex/properties/database"
import { resolveNoteImageUrl } from "../split-view/noteEditorAssets"
import { DatabaseCard } from "./DatabaseCard"

interface DatabaseGalleryViewProps {
	rows: DatabaseRow[]
	coverKey: string | undefined
	columns: PropertyDefinition[]
	selectedPath: string | null
	authorConfig: ResolvedAuthorConfig
	today: string
	onSelect: (path: string) => void
}

function getCoverSource(row: DatabaseRow, coverKey: string | undefined): string | null {
	const fromProperty = coverKey ? getPropertyValueList(row.meta[coverKey])[0] : undefined
	if (typeof fromProperty === "string" && fromProperty.trim()) return fromProperty.trim()
	return row.cover
}

export function DatabaseGalleryView({
	rows,
	coverKey,
	columns,
	selectedPath,
	authorConfig,
	today,
	onSelect,
}: DatabaseGalleryViewProps) {
	const cardProperties = columns.slice(0, 3)
	return (
		<div className="db-gallery">
			{rows.map((row) => {
				const source = getCoverSource(row, coverKey)
				return (
					<DatabaseCard
						key={row.path}
						row={row}
						properties={cardProperties}
						authorConfig={authorConfig}
						today={today}
						selected={row.path === selectedPath}
						variant="gallery"
						coverUrl={source ? resolveNoteImageUrl(source, row.path) : null}
						onSelect={onSelect}
					/>
				)
			})}
		</div>
	)
}
