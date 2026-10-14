import { updateDatabaseCell } from "@cortex/core"
import {
	getPropertyType,
	type PropertyDefinition,
	type ResolvedAuthorConfig,
} from "@cortex/properties"
import type { DatabaseRow } from "@cortex/properties/database"
import { Button, Popover, PopoverContent, PopoverTrigger } from "@cortex/ui"
import { memo, useState } from "react"
import { PropertyValueEditor } from "../properties/editors/PropertyValueEditor"
import { DatabaseValue } from "./DatabaseValue"

interface DatabaseCellProps {
	folderPath: string
	row: DatabaseRow
	definition: PropertyDefinition
	authorConfig: ResolvedAuthorConfig
	today: string
	onUpdateDefinition: (definition: PropertyDefinition) => Promise<void>
}

export const DatabaseCell = memo(function DatabaseCell({
	folderPath,
	row,
	definition,
	authorConfig,
	today,
	onUpdateDefinition,
}: DatabaseCellProps) {
	const [open, setOpen] = useState(false)
	const value = row.meta[definition.key]
	const display = (
		<DatabaseValue
			definition={definition}
			value={value}
			authorConfig={authorConfig}
			today={today}
			compact
		/>
	)
	if (getPropertyType(definition.type)?.readOnly) {
		return <span className="db-cell db-cell-readonly">{display}</span>
	}
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					size="sm"
					variant="ghost"
					className="db-cell"
					aria-label={`Edit ${definition.name} for ${row.title}`}
				>
					{display}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="note-property-popover db-cell-editor">
				{open && (
					<PropertyValueEditor
						definition={definition}
						filePath={row.path}
						value={value}
						authorConfig={authorConfig}
						onSetValue={(next) => updateDatabaseCell(folderPath, row.path, definition.key, next)}
						onRemoveValue={() =>
							updateDatabaseCell(folderPath, row.path, definition.key, undefined)
						}
						onUpdateDefinition={onUpdateDefinition}
						onClose={() => setOpen(false)}
					/>
				)}
			</PopoverContent>
		</Popover>
	)
})
