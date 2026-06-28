import type { PropertyDefinition } from "@cortex/properties"
import { Button } from "@cortex/ui"
import { ArrowDownAZIcon, CheckIcon } from "lucide-react"
import { PropertyTypeIcon } from "../PropertyTypeIcon"
import { PanelHeader } from "./PanelHeader"

interface PropertySortPickerProps {
	definition: PropertyDefinition
	onBack(): void
	onUpdateDefinition(definition: PropertyDefinition): Promise<void>
}

export function PropertySortPicker({
	definition,
	onBack,
	onUpdateDefinition,
}: PropertySortPickerProps) {
	return (
		<div className="note-property-picker-panel">
			<PanelHeader title="Sort options" onBack={onBack} />
			<div className="note-property-choice-list">
				{(["manual", "alphabetical"] as const).map((sort) => (
					<Button
						key={sort}
						variant="ghost"
						onClick={() => {
							void onUpdateDefinition({ ...definition, optionSort: sort }).then(onBack)
						}}
					>
						{sort === "manual" ? <PropertyTypeIcon icon="list-end" /> : <ArrowDownAZIcon />}
						<span>{sort === "manual" ? "Manual" : "Alphabetical"}</span>
						{(definition.optionSort ?? "manual") === sort && <CheckIcon className="ml-auto" />}
					</Button>
				))}
			</div>
		</div>
	)
}
