import type { PropertyOption } from "@cortex/properties"
import { Button } from "@cortex/ui"
import { XIcon } from "lucide-react"

interface PropertyOptionValueProps {
	option: PropertyOption
	onRemove?: () => void
}

export function PropertyOptionValue({ option, onRemove }: PropertyOptionValueProps) {
	return (
		<span className="note-property-option-value" data-color={option.color}>
			<span className="note-property-color-dot" data-color={option.color} />
			<span>{option.label}</span>
			{onRemove && (
				<Button
					variant="ghost"
					size="icon-xs"
					className="note-property-option-remove"
					aria-label={`Remove ${option.label}`}
					onClick={(event) => {
						event.stopPropagation()
						onRemove()
					}}
				>
					<XIcon />
				</Button>
			)}
		</span>
	)
}
