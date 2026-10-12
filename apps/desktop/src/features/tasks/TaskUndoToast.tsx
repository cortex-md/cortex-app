import { Button } from "@cortex/ui"
import { useEffect } from "react"
import { type TaskSurface, taskUndoToast, undoTaskEdit } from "./taskModel"

const UNDO_TIMEOUT_MS = 6000

export function TaskUndoToast({ surface }: { surface: TaskSurface }) {
	const target = taskUndoToast.useTarget()

	useEffect(() => {
		if (!target) return
		const timer = setTimeout(() => {
			if (taskUndoToast.getTarget() === target) taskUndoToast.close()
		}, UNDO_TIMEOUT_MS)
		return () => clearTimeout(timer)
	}, [target])

	if (!target || target.surface !== surface) return null

	return (
		<output className="task-undo-toast" data-surface={surface}>
			<span className="task-undo-toast-message">{target.message}</span>
			<Button
				variant="ghost"
				size="xs"
				className="task-undo-toast-action"
				onClick={() => void undoTaskEdit(target)}
			>
				Undo
			</Button>
		</output>
	)
}
