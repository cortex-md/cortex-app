import { Button } from "@cortex/ui"
import { ChevronLeftIcon } from "lucide-react"

interface PanelHeaderProps {
	title: string
	onBack?: () => void
}

export function PanelHeader({ title, onBack }: PanelHeaderProps) {
	if (!onBack) return null
	return (
		<div className="note-property-popover-header">
			<Button variant="ghost" size="icon-xs" aria-label="Back" onClick={onBack}>
				<ChevronLeftIcon />
			</Button>
			<strong>{title}</strong>
		</div>
	)
}
