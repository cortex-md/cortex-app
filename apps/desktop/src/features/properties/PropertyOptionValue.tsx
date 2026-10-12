import type { PropertyOption } from "@cortex/properties"
import { Button, StatusBadge } from "@cortex/ui"
import { XIcon } from "lucide-react"

interface PropertyOptionValueProps {
	option: PropertyOption
	onRemove?: () => void
}

export function PropertyOptionValue({ option, onRemove }: PropertyOptionValueProps) {
	return (
		<StatusBadge color={option.color} className="note-property-option-value">
			<span className="truncate">{option.label}</span>
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
		</StatusBadge>
	)
}
