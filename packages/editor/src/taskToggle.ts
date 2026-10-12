import { isTaskLine, toggleTaskLine, toIsoDate } from "@cortex/tasks"
import type { EditorRuntimeView } from "./types"

const TASK_MARKER_PATTERN = /\[([ xX])\]/

export function toggleTaskAt(view: EditorRuntimeView, position: number): boolean {
	const { state } = view
	if (state.readOnly) return false
	const line = state.doc.lineAt(position)
	const previous = line.text
	let next = isTaskLine(previous) ? toggleTaskLine(previous, toIsoDate(new Date())).line : previous
	if (next === previous) {
		const marker = TASK_MARKER_PATTERN.exec(previous.slice(Math.max(0, position - line.from)))
		if (!marker || marker.index !== 0) return false
		const offset = position - line.from
		next = `${previous.slice(0, offset)}[${marker[1] === " " ? "x" : " "}]${previous.slice(offset + 3)}`
	}
	let start = 0
	while (start < previous.length && start < next.length && previous[start] === next[start]) start++
	let end = 0
	while (
		end < previous.length - start &&
		end < next.length - start &&
		previous[previous.length - 1 - end] === next[next.length - 1 - end]
	) {
		end++
	}
	view.dispatch({
		changes: {
			from: line.from + start,
			to: line.to - end,
			insert: next.slice(start, next.length - end),
		},
	})
	return true
}
