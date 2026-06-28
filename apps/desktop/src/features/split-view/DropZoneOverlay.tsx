import type { DropZone } from "@cortex/core"
import { useDragStore } from "@cortex/core"

interface Props {
	paneId: string
}

const zoneStyles: Record<DropZone, string> = {
	center: "inset-4",
	left: "inset-y-2 left-2 w-[45%]",
	right: "inset-y-2 right-2 w-[45%]",
	top: "inset-x-2 top-2 h-[45%]",
	bottom: "inset-x-2 bottom-2 h-[45%]",
}

export function DropZoneOverlay({ paneId }: Props) {
	const isDragging = useDragStore((s) => !!s.dragSource)
	const dropTarget = useDragStore((s) => s.dropTarget)
	const hoveredZone = dropTarget?.paneId === paneId ? dropTarget.zone : null

	if (!isDragging) return null

	return (
		<div className="pointer-events-none absolute inset-0 z-50">
			{hoveredZone && (
				<>
					<div className="absolute inset-0 bg-brand/10 rounded pointer-events-none" />
					<div
						className={`absolute ${zoneStyles[hoveredZone]} rounded-lg bg-brand/20 border-2 border-brand/70 ring-1 ring-brand/40 shadow-lg pointer-events-none transition-all duration-150`}
					/>
				</>
			)}
		</div>
	)
}
