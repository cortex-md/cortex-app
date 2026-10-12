import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react"

const DRAG_THRESHOLD_PX = 6

interface SortableDragState {
	fromIndex: number
	dropIndex: number
}

export interface SortableItemProps {
	"data-sortable-index": number
	"data-dragging"?: true
	"data-drop-before"?: true
	"data-drop-after"?: true
	onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
	onClickCapture: (event: React.MouseEvent<HTMLElement>) => void
}

function findDropIndex(list: HTMLElement, clientY: number, count: number): number {
	const rows = list.querySelectorAll<HTMLElement>("[data-sortable-index]")
	for (const row of rows) {
		const rect = row.getBoundingClientRect()
		if (clientY < rect.top + rect.height / 2) return Number(row.dataset.sortableIndex)
	}
	return count
}

export function useSortableList(
	count: number,
	onReorder: (fromIndex: number, toIndex: number) => void,
) {
	const listRef = useRef<HTMLDivElement>(null)
	const [drag, setDrag] = useState<SortableDragState | null>(null)
	const suppressClickRef = useRef(false)

	const getItemProps = (index: number): SortableItemProps => ({
		"data-sortable-index": index,
		"data-dragging": drag?.fromIndex === index ? true : undefined,
		"data-drop-before":
			drag && drag.dropIndex === index && drag.fromIndex !== index ? true : undefined,
		"data-drop-after":
			drag && index === count - 1 && drag.dropIndex === count && drag.fromIndex !== index
				? true
				: undefined,
		onClickCapture: (event) => {
			if (!suppressClickRef.current) return
			suppressClickRef.current = false
			event.preventDefault()
			event.stopPropagation()
		},
		onPointerDown: (event) => {
			if (event.button !== 0) return
			const startY = event.clientY
			let started = false
			const handleMove = (moveEvent: PointerEvent) => {
				const list = listRef.current
				if (!list) return
				if (!started && Math.abs(moveEvent.clientY - startY) < DRAG_THRESHOLD_PX) return
				started = true
				setDrag({ fromIndex: index, dropIndex: findDropIndex(list, moveEvent.clientY, count) })
			}
			const handleUp = (upEvent: PointerEvent) => {
				document.removeEventListener("pointermove", handleMove)
				document.removeEventListener("pointerup", handleUp)
				const list = listRef.current
				setDrag(null)
				if (!started || !list) return
				suppressClickRef.current = true
				const dropIndex = findDropIndex(list, upEvent.clientY, count)
				const toIndex = dropIndex > index ? dropIndex - 1 : dropIndex
				if (toIndex !== index) onReorder(index, toIndex)
			}
			document.addEventListener("pointermove", handleMove)
			document.addEventListener("pointerup", handleUp)
		},
	})

	return { listRef, isDragging: drag !== null, getItemProps }
}
